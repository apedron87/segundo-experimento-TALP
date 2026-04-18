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
const createGoalsMap = (goals) => goals.reduce((acc, goal) => {
    acc[goal] = 'MANA';
    return acc;
}, {});
const createEmptyDatabase = () => ({
    nextId: 1,
    goals: [...DEFAULT_GOALS],
    students: [],
    evaluations: {},
    classes: [],
    classEvaluations: {},
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
    const classes = Array.isArray(raw.classes)
        ? raw.classes.filter((item) => typeof item?.id === 'string'
            && typeof item?.topic === 'string'
            && typeof item?.year === 'number'
            && typeof item?.semester === 'number'
            && Array.isArray(item?.studentIds))
        : [];
    const validStudentIds = new Set(students.map((student) => student.id));
    const normalizedClasses = classes.map((item) => ({
        id: item.id,
        topic: item.topic.trim(),
        year: item.year,
        semester: item.semester,
        studentIds: Array.from(new Set(item.studentIds.filter((id) => validStudentIds.has(id)))),
    }));
    const evaluations = {};
    const rawEvaluations = raw.evaluations ?? {};
    for (const student of students) {
        const source = typeof rawEvaluations[student.id] === 'object' && rawEvaluations[student.id] !== null
            ? rawEvaluations[student.id]
            : {};
        const goalsMap = {};
        for (const goal of goals) {
            const value = source[goal];
            goalsMap[goal] = typeof value === 'string' && isConcept(value) ? value : 'MANA';
        }
        evaluations[student.id] = goalsMap;
    }
    const classEvaluations = {};
    const rawClassEvaluations = raw.classEvaluations ?? {};
    for (const schoolClass of normalizedClasses) {
        const classStore = typeof rawClassEvaluations[schoolClass.id] === 'object' && rawClassEvaluations[schoolClass.id] !== null
            ? rawClassEvaluations[schoolClass.id]
            : {};
        classEvaluations[schoolClass.id] = {};
        for (const studentId of schoolClass.studentIds) {
            const studentStore = typeof classStore[studentId] === 'object' && classStore[studentId] !== null
                ? classStore[studentId]
                : {};
            const goalsMap = {};
            for (const goal of goals) {
                const value = studentStore[goal];
                goalsMap[goal] = typeof value === 'string' && isConcept(value) ? value : 'MANA';
            }
            classEvaluations[schoolClass.id][studentId] = goalsMap;
        }
    }
    const nextId = typeof raw.nextId === 'number' && Number.isFinite(raw.nextId) && raw.nextId > 0
        ? raw.nextId
        : [...students.map((item) => Number(item.id) || 0), ...normalizedClasses.map((item) => Number(item.id) || 0)]
            .reduce((max, current) => Math.max(max, current), 0) + 1;
    return {
        nextId,
        goals,
        students,
        evaluations,
        classes: normalizedClasses,
        classEvaluations,
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
const parsePositiveInteger = (value) => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
        const number = Number(value);
        return number > 0 ? number : null;
    }
    return null;
};
const validateClassPayload = (payload, students) => {
    const topic = normalize(payload.topic ?? '');
    const year = parsePositiveInteger(payload.year);
    const semester = parsePositiveInteger(payload.semester);
    const ids = Array.isArray(payload.studentIds) ? payload.studentIds : [];
    if (!topic || year === null || semester === null) {
        return 'topic, year e semester sao obrigatorios';
    }
    if (semester !== 1 && semester !== 2) {
        return 'semester deve ser 1 ou 2';
    }
    const validStudentIds = new Set(students.map((student) => student.id));
    if (!ids.every((id) => typeof id === 'string' && validStudentIds.has(id))) {
        return 'studentIds contem aluno invalido';
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
const validateClassEvaluationPayload = (payload, goals) => {
    const studentId = normalize(payload.studentId ?? '');
    const goal = normalize(payload.goal ?? '');
    const concept = normalize(payload.concept ?? '');
    if (!studentId || !goal || !concept) {
        return 'studentId, goal e concept sao obrigatorios';
    }
    if (!goals.includes(goal)) {
        return 'meta invalida';
    }
    if (!isConcept(concept)) {
        return 'conceito invalido';
    }
    return null;
};
const hasDuplicateData = (students, cpf, email, ignoreId) => students.some((student) => student.id !== ignoreId
    && (student.cpf.toLowerCase() === cpf.toLowerCase()
        || student.email.toLowerCase() === email.toLowerCase()));
const buildEvaluationRows = (db) => db.students.map((student) => ({
    studentId: student.id,
    name: student.name,
    evaluations: db.goals.reduce((acc, goal) => {
        acc[goal] = db.evaluations[student.id]?.[goal] ?? 'MANA';
        return acc;
    }, {}),
}));
const buildClassDetail = (db, schoolClass) => {
    const studentMap = new Map(db.students.map((student) => [student.id, student]));
    const rows = schoolClass.studentIds
        .map((studentId) => studentMap.get(studentId))
        .filter((student) => Boolean(student))
        .map((student) => ({
        studentId: student.id,
        name: student.name,
        cpf: student.cpf,
        email: student.email,
        evaluations: db.goals.reduce((acc, goal) => {
            acc[goal] = db.classEvaluations[schoolClass.id]?.[student.id]?.[goal] ?? 'MANA';
            return acc;
        }, {}),
    }));
    return {
        id: schoolClass.id,
        topic: schoolClass.topic,
        year: schoolClass.year,
        semester: schoolClass.semester,
        goals: db.goals,
        rows,
    };
};
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
        const student = { id: String(db.nextId++), name, cpf, email };
        db.students.push(student);
        db.evaluations[student.id] = createGoalsMap(db.goals);
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
        db.classes = db.classes.map((schoolClass) => ({
            ...schoolClass,
            studentIds: schoolClass.studentIds.filter((studentId) => studentId !== id),
        }));
        for (const schoolClass of db.classes) {
            delete db.classEvaluations[schoolClass.id]?.[id];
        }
        writeDatabase(dbFilePath, db);
        return res.status(204).send();
    });
    app.get('/evaluations', (_req, res) => {
        const db = readDatabase(dbFilePath);
        res.status(200).json({ goals: db.goals, rows: buildEvaluationRows(db) });
    });
    app.put('/students/:id/evaluations', (req, res) => {
        var _a;
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        if (!db.students.some((item) => item.id === id)) {
            return res.status(404).json({ message: 'aluno nao encontrado' });
        }
        const payload = req.body;
        const error = validateEvaluationPayload(payload, db.goals);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const goal = normalize(payload.goal);
        const concept = normalize(payload.concept);
        (_a = db.evaluations)[id] ?? (_a[id] = createGoalsMap(db.goals));
        db.evaluations[id][goal] = concept;
        writeDatabase(dbFilePath, db);
        return res.status(200).json({ studentId: id, goal, concept });
    });
    app.get('/classes', (_req, res) => {
        const db = readDatabase(dbFilePath);
        res.status(200).json(db.classes);
    });
    app.get('/classes/:id', (req, res) => {
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        const schoolClass = db.classes.find((item) => item.id === id);
        if (!schoolClass) {
            return res.status(404).json({ message: 'turma nao encontrada' });
        }
        return res.status(200).json(buildClassDetail(db, schoolClass));
    });
    app.post('/classes', (req, res) => {
        const db = readDatabase(dbFilePath);
        const payload = req.body;
        const error = validateClassPayload(payload, db.students);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const schoolClass = {
            id: String(db.nextId++),
            topic: normalize(payload.topic),
            year: parsePositiveInteger(payload.year),
            semester: parsePositiveInteger(payload.semester),
            studentIds: Array.from(new Set(payload.studentIds ?? [])),
        };
        db.classes.push(schoolClass);
        db.classEvaluations[schoolClass.id] = {};
        for (const studentId of schoolClass.studentIds) {
            db.classEvaluations[schoolClass.id][studentId] = createGoalsMap(db.goals);
        }
        writeDatabase(dbFilePath, db);
        return res.status(201).json(schoolClass);
    });
    app.put('/classes/:id', (req, res) => {
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        const current = db.classes.find((item) => item.id === id);
        if (!current) {
            return res.status(404).json({ message: 'turma nao encontrada' });
        }
        const payload = req.body;
        const error = validateClassPayload(payload, db.students);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const updated = {
            id,
            topic: normalize(payload.topic),
            year: parsePositiveInteger(payload.year),
            semester: parsePositiveInteger(payload.semester),
            studentIds: Array.from(new Set(payload.studentIds ?? [])),
        };
        const existingEvaluations = db.classEvaluations[id] ?? {};
        const rebuiltEvaluations = {};
        for (const studentId of updated.studentIds) {
            rebuiltEvaluations[studentId] = existingEvaluations[studentId] ?? createGoalsMap(db.goals);
        }
        db.classEvaluations[id] = rebuiltEvaluations;
        db.classes = db.classes.map((item) => (item.id === id ? updated : item));
        writeDatabase(dbFilePath, db);
        return res.status(200).json(updated);
    });
    app.delete('/classes/:id', (req, res) => {
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        const previousLength = db.classes.length;
        db.classes = db.classes.filter((item) => item.id !== id);
        if (db.classes.length === previousLength) {
            return res.status(404).json({ message: 'turma nao encontrada' });
        }
        delete db.classEvaluations[id];
        writeDatabase(dbFilePath, db);
        return res.status(204).send();
    });
    app.put('/classes/:id/evaluations', (req, res) => {
        var _a, _b;
        const id = parseRouteId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: 'id invalido' });
        }
        const db = readDatabase(dbFilePath);
        const schoolClass = db.classes.find((item) => item.id === id);
        if (!schoolClass) {
            return res.status(404).json({ message: 'turma nao encontrada' });
        }
        const payload = req.body;
        const error = validateClassEvaluationPayload(payload, db.goals);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const studentId = normalize(payload.studentId);
        if (!schoolClass.studentIds.includes(studentId)) {
            return res.status(400).json({ message: 'aluno nao matriculado na turma' });
        }
        const goal = normalize(payload.goal);
        const concept = normalize(payload.concept);
        (_a = db.classEvaluations)[id] ?? (_a[id] = {});
        (_b = db.classEvaluations[id])[studentId] ?? (_b[studentId] = createGoalsMap(db.goals));
        db.classEvaluations[id][studentId][goal] = concept;
        writeDatabase(dbFilePath, db);
        return res.status(200).json({ classId: id, studentId, goal, concept });
    });
    return app;
};
exports.createApp = createApp;
