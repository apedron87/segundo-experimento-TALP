import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Request, type Response } from 'express';

export interface Student {
  id: string;
  name: string;
  cpf: string;
  email: string;
}

export type Concept = 'MANA' | 'MPA' | 'MA';

interface StudentPayload {
  name?: string;
  cpf?: string;
  email?: string;
}

interface EvaluationPayload {
  goal?: string;
  concept?: Concept;
}

interface Database {
  nextId: number;
  goals: string[];
  students: Student[];
  evaluations: Record<string, Record<string, Concept>>;
}

type RouteId = string | string[] | undefined;

const DEFAULT_GOALS = ['Requisitos', 'Testes', 'Documentacao'];
const DEFAULT_DB_FILE = path.resolve(__dirname, '..', 'data', 'database.json');
const CONCEPT_VALUES: Concept[] = ['MANA', 'MPA', 'MA'];

const normalize = (value: string): string => value.trim();
const isEmail = (value: string): boolean => /\S+@\S+\.\S+/.test(value);
const isConcept = (value: string): value is Concept => CONCEPT_VALUES.includes(value as Concept);

const parseRouteId = (routeId: RouteId): string | null => {
  if (typeof routeId !== 'string') {
    return null;
  }

  const id = routeId.trim();
  return id.length > 0 ? id : null;
};

const createEmptyDatabase = (): Database => ({
  nextId: 1,
  goals: [...DEFAULT_GOALS],
  students: [],
  evaluations: {},
});

const ensureDatabaseFile = (dbFilePath: string): void => {
  const folder = path.dirname(dbFilePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify(createEmptyDatabase(), null, 2), 'utf-8');
  }
};

const normalizeDatabase = (raw: Partial<Database>): Database => {
  const goals = Array.isArray(raw.goals) && raw.goals.length > 0
    ? raw.goals.filter((goal): goal is string => typeof goal === 'string' && goal.trim().length > 0)
    : [...DEFAULT_GOALS];

  const students = Array.isArray(raw.students)
    ? raw.students.filter(
      (student): student is Student =>
        typeof student?.id === 'string'
        && typeof student?.name === 'string'
        && typeof student?.cpf === 'string'
        && typeof student?.email === 'string',
    )
    : [];

  const evaluations: Record<string, Record<string, Concept>> = {};
  const rawEvaluations = raw.evaluations ?? {};

  for (const student of students) {
    const source =
      typeof rawEvaluations[student.id] === 'object' && rawEvaluations[student.id] !== null
        ? rawEvaluations[student.id]
        : {};

    const goalConcepts: Record<string, Concept> = {};
    for (const goal of goals) {
      const value = source[goal];
      goalConcepts[goal] = typeof value === 'string' && isConcept(value) ? value : 'MANA';
    }

    evaluations[student.id] = goalConcepts;
  }

  const nextId =
    typeof raw.nextId === 'number' && Number.isFinite(raw.nextId) && raw.nextId > 0
      ? raw.nextId
      : students.reduce((max, student) => Math.max(max, Number(student.id) || 0), 0) + 1;

  return {
    nextId,
    goals,
    students,
    evaluations,
  };
};

const readDatabase = (dbFilePath: string): Database => {
  ensureDatabaseFile(dbFilePath);
  const content = fs.readFileSync(dbFilePath, 'utf-8');
  const parsed = JSON.parse(content) as Partial<Database>;
  return normalizeDatabase(parsed);
};

const writeDatabase = (dbFilePath: string, db: Database): void => {
  fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
};

const validateStudentPayload = (payload: StudentPayload): string | null => {
  const name = normalize(payload.name ?? '');
  const cpf = normalize(payload.cpf ?? '');
  const email = normalize(payload.email ?? '');

  if (!name || !cpf || !email) {
    return 'name, cpf e email sao obrigatorios';
  }

  if (!isEmail(email)) {
    return 'email invalido';
  }

  return null;
};

const validateEvaluationPayload = (
  payload: EvaluationPayload,
  goals: string[],
): string | null => {
  const goal = normalize(payload.goal ?? '');
  const concept = normalize(payload.concept ?? '');

  if (!goal || !concept) {
    return 'goal e concept sao obrigatorios';
  }

  if (!goals.includes(goal)) {
    return 'meta invalida';
  }

  if (!isConcept(concept)) {
    return 'conceito invalido';
  }

  return null;
};

const hasDuplicateData = (
  students: Student[],
  cpf: string,
  email: string,
  ignoreId?: string,
): boolean =>
  students.some(
    (student) =>
      student.id !== ignoreId &&
      (student.cpf.toLowerCase() === cpf.toLowerCase()
        || student.email.toLowerCase() === email.toLowerCase()),
  );

const buildEvaluationRows = (db: Database) =>
  db.students.map((student) => ({
    studentId: student.id,
    name: student.name,
    evaluations: db.goals.reduce<Record<string, Concept>>((acc, goal) => {
      acc[goal] = db.evaluations[student.id]?.[goal] ?? 'MANA';
      return acc;
    }, {}),
  }));

export const resetStudentsStore = (dbFilePath = DEFAULT_DB_FILE): void => {
  ensureDatabaseFile(dbFilePath);
  writeDatabase(dbFilePath, createEmptyDatabase());
};

export const createApp = (options?: { dbFilePath?: string }) => {
  const dbFilePath = options?.dbFilePath ?? DEFAULT_DB_FILE;
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/students', (_req: Request, res: Response) => {
    const db = readDatabase(dbFilePath);
    res.status(200).json(db.students);
  });

  app.post('/students', (req: Request, res: Response) => {
    const payload = req.body as StudentPayload;
    const error = validateStudentPayload(payload);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const db = readDatabase(dbFilePath);
    const name = normalize(payload.name!);
    const cpf = normalize(payload.cpf!);
    const email = normalize(payload.email!);

    if (hasDuplicateData(db.students, cpf, email)) {
      return res.status(409).json({ message: 'ja existe aluno com mesmo cpf ou email' });
    }

    const student: Student = {
      id: String(db.nextId++),
      name,
      cpf,
      email,
    };

    db.students.push(student);
    db.evaluations[student.id] = db.goals.reduce<Record<string, Concept>>((acc, goal) => {
      acc[goal] = 'MANA';
      return acc;
    }, {});

    writeDatabase(dbFilePath, db);
    return res.status(201).json(student);
  });

  app.put('/students/:id', (req: Request, res: Response) => {
    const id = parseRouteId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'id invalido' });
    }

    const payload = req.body as StudentPayload;
    const error = validateStudentPayload(payload);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const db = readDatabase(dbFilePath);
    const current = db.students.find((student) => student.id === id);
    if (!current) {
      return res.status(404).json({ message: 'aluno nao encontrado' });
    }

    const name = normalize(payload.name!);
    const cpf = normalize(payload.cpf!);
    const email = normalize(payload.email!);

    if (hasDuplicateData(db.students, cpf, email, id)) {
      return res.status(409).json({ message: 'ja existe aluno com mesmo cpf ou email' });
    }

    const updated: Student = { id, name, cpf, email };
    db.students = db.students.map((student) => (student.id === id ? updated : student));
    writeDatabase(dbFilePath, db);

    return res.status(200).json(updated);
  });

  app.delete('/students/:id', (req: Request, res: Response) => {
    const id = parseRouteId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'id invalido' });
    }

    const db = readDatabase(dbFilePath);
    const previousLength = db.students.length;

    db.students = db.students.filter((student) => student.id !== id);
    if (db.students.length === previousLength) {
      return res.status(404).json({ message: 'aluno nao encontrado' });
    }

    delete db.evaluations[id];
    writeDatabase(dbFilePath, db);
    return res.status(204).send();
  });

  app.get('/evaluations', (_req: Request, res: Response) => {
    const db = readDatabase(dbFilePath);
    res.status(200).json({
      goals: db.goals,
      rows: buildEvaluationRows(db),
    });
  });

  app.put('/students/:id/evaluations', (req: Request, res: Response) => {
    const id = parseRouteId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'id invalido' });
    }

    const db = readDatabase(dbFilePath);
    const student = db.students.find((item) => item.id === id);
    if (!student) {
      return res.status(404).json({ message: 'aluno nao encontrado' });
    }

    const payload = req.body as EvaluationPayload;
    const error = validateEvaluationPayload(payload, db.goals);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const goal = normalize(payload.goal!);
    const concept = normalize(payload.concept!) as Concept;
    db.evaluations[id] ??= {};
    db.evaluations[id][goal] = concept;
    writeDatabase(dbFilePath, db);

    return res.status(200).json({
      studentId: id,
      goal,
      concept,
    });
  });

  return app;
};
