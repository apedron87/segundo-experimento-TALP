"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = exports.resetStudentsStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const DEFAULT_GOALS = ['Requisitos', 'Testes', 'Documentacao'];
const DEFAULT_DB_FILE = node_path_1.default.resolve(__dirname, '..', 'data', 'database.json');
const CONCEPT_VALUES = ['MANA', 'MPA', 'MA'];
const normalize = (value) => value.trim();
const isEmail = (value) => /\S+@\S+\.\S+/.test(value);
const isConcept = (value) => CONCEPT_VALUES.includes(value);
const parseRouteId = (routeId) => {
    if (typeof routeId !== 'string') {
        return null;
    }
    const id = routeId.trim();
    return id.length > 0 ? id : null;
};
const createEmptyDatabase = () => ({
    nextId: 1,
    goals: [...DEFAULT_GOALS],
    students: [],
    evaluations: {},
});
const ensureDatabaseFile = (dbFilePath) => {
    const folder = node_path_1.default.dirname(dbFilePath);
    if (!node_fs_1.default.existsSync(folder)) {
        node_fs_1.default.mkdirSync(folder, { recursive: true });
    }
    if (!node_fs_1.default.existsSync(dbFilePath)) {
        node_fs_1.default.writeFileSync(dbFilePath, JSON.stringify(createEmptyDatabase(), null, 2), 'utf-8');
    }
};
const normalizeDatabase = (raw) => {
    const goals = Array.isArray(raw.goals) && raw.goals.length > 0
        ? raw.goals.filter((goal) => typeof goal === 'string' && goal.trim().length > 0)
        : [...DEFAULT_GOALS];
    const students = Array.isArray(raw.students)
        ? raw.students.filter((student) => typeof student?.id === 'string'
            && typeof student?.name === 'string'
            && typeof student?.cpf === 'string'
            && typeof student?.email === 'string')
        : [];
    const evaluations = {};
    const rawEvaluations = raw.evaluations ?? {};
    for (const student of students) {
        const source = typeof rawEvaluations[student.id] === 'object' && rawEvaluations[student.id] !== null
            ? rawEvaluations[student.id]
            : {};
        const goalConcepts = {};
        for (const goal of goals) {
            const value = source[goal];
            goalConcepts[goal] = typeof value === 'string' && isConcept(value) ? value : 'MANA';
        }
        evaluations[student.id] = goalConcepts;
    }
    const nextId = typeof raw.nextId === 'number' && Number.isFinite(raw.nextId) && raw.nextId > 0
        ? raw.nextId
        : students.reduce((max, student) => Math.max(max, Number(student.id) || 0), 0) + 1;
    return {
        nextId,
        goals,
        students,
        evaluations,
    };
};
const readDatabase = (dbFilePath) => {
    ensureDatabaseFile(dbFilePath);
    const content = node_fs_1.default.readFileSync(dbFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return normalizeDatabase(parsed);
};
const writeDatabase = (dbFilePath, db) => {
    node_fs_1.default.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
};
const validateStudentPayload = (payload) => {
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
const validateEvaluationPayload = (payload, goals) => {
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
const hasDuplicateData = (students, cpf, email, ignoreId) => students.some((student) => student.id !== ignoreId &&
    (student.cpf.toLowerCase() === cpf.toLowerCase()
        || student.email.toLowerCase() === email.toLowerCase()));
const buildEvaluationRows = (db) => db.students.map((student) => ({
    studentId: student.id,
    name: student.name,
    evaluations: db.goals.reduce((acc, goal) => {
        acc[goal] = db.evaluations[student.id]?.[goal] ?? 'MANA';
        return acc;
    }, {}),
}));
const resetStudentsStore = (dbFilePath = DEFAULT_DB_FILE) => {
    ensureDatabaseFile(dbFilePath);
    writeDatabase(dbFilePath, createEmptyDatabase());
};
exports.resetStudentsStore = resetStudentsStore;
const createApp = (options) => {
    const dbFilePath = options?.dbFilePath ?? DEFAULT_DB_FILE;
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.get('/students', (_req, res) => {
        const db = readDatabase(dbFilePath);
        res.status(200).json(db.students);
    });
    app.post('/students', (req, res) => {
        const payload = req.body;
        const error = validateStudentPayload(payload);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const db = readDatabase(dbFilePath);
        const name = normalize(payload.name);
        const cpf = normalize(payload.cpf);
        const email = normalize(payload.email);
        if (hasDuplicateData(db.students, cpf, email)) {
            return res.status(409).json({ message: 'ja existe aluno com mesmo cpf ou email' });
        }
        const student = {
            id: String(db.nextId++),
            name,
            cpf,
            email,
        };
        db.students.push(student);
        db.evaluations[student.id] = db.goals.reduce((acc, goal) => {
            acc[goal] = 'MANA';
            return acc;
        }, {});
        writeDatabase(dbFilePath, db);
        return res.status(201).json(student);
    });
    app.put('/students/:id', (req, res) => {
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const payload = req.body;
        const error = validateStudentPayload(payload);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const db = readDatabase(dbFilePath);
        const current = db.students.find((student) => student.id === id);
        if (!current) {
            return res.status(404).json({ message: 'aluno nao encontrado' });
        }
        const name = normalize(payload.name);
        const cpf = normalize(payload.cpf);
        const email = normalize(payload.email);
        if (hasDuplicateData(db.students, cpf, email, id)) {
            return res.status(409).json({ message: 'ja existe aluno com mesmo cpf ou email' });
        }
        const updated = { id, name, cpf, email };
        db.students = db.students.map((student) => (student.id === id ? updated : student));
        writeDatabase(dbFilePath, db);
        return res.status(200).json(updated);
    });
    app.delete('/students/:id', (req, res) => {
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
    app.get('/evaluations', (_req, res) => {
        const db = readDatabase(dbFilePath);
        res.status(200).json({
            goals: db.goals,
            rows: buildEvaluationRows(db),
        });
    });
    app.put('/students/:id/evaluations', (req, res) => {
        var _a;
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        const student = db.students.find((item) => item.id === id);
        if (!student) {
            return res.status(404).json({ message: 'aluno nao encontrado' });
        }
        const payload = req.body;
        const error = validateEvaluationPayload(payload, db.goals);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const goal = normalize(payload.goal);
        const concept = normalize(payload.concept);
        (_a = db.evaluations)[id] ?? (_a[id] = {});
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
exports.createApp = createApp;
