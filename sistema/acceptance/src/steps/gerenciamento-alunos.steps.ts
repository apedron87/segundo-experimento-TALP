import assert from 'node:assert/strict';
import { Given, When, Then } from '@cucumber/cucumber';
import request, { type Response } from 'supertest';
import { createApp, resetStudentsStore, type Student } from '../../../server/src/app';

let lastResponse: Response | undefined;

const api = () => request(createApp());

interface EvaluationRow {
  studentId: string;
  name: string;
  evaluations: Record<string, string>;
}

interface EvaluationResponse {
  goals: string[];
  rows: EvaluationRow[];
}

interface SchoolClass {
  id: string;
  topic: string;
  year: number;
  semester: number;
  studentIds: string[];
}

interface ClassDetailRow {
  studentId: string;
  name: string;
  cpf: string;
  email: string;
  evaluations: Record<string, string>;
}

interface ClassDetailResponse {
  id: string;
  topic: string;
  year: number;
  semester: number;
  goals: string[];
  rows: ClassDetailRow[];
}

interface EmailMessage {
  id: string;
  studentId: string;
  to: string;
  date: string;
  subject: string;
  body: string;
}

const today = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

Given('que nao existem alunos cadastrados', () => {
  resetStudentsStore();
  lastResponse = undefined;
});

When(
  'eu cadastro um aluno com nome {string}, cpf {string} e email {string}',
  async (name: string, cpf: string, email: string) => {
    lastResponse = await api().post('/students').send({ name, cpf, email });
    assert.equal(lastResponse.status, 201);
  },
);

When(
  'eu altero o aluno de cpf {string} para nome {string} e email {string}',
  async (cpf: string, name: string, email: string) => {
    const listResponse = await api().get('/students');
    assert.equal(listResponse.status, 200);

    const student = (listResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para alteracao`);

    lastResponse = await api()
      .put(`/students/${student.id}`)
      .send({ name, cpf, email });

    assert.equal(lastResponse.status, 200);
  },
);

When('eu removo o aluno de cpf {string}', async (cpf: string) => {
  const listResponse = await api().get('/students');
  assert.equal(listResponse.status, 200);

  const student = (listResponse.body as Student[]).find((item) => item.cpf === cpf);
  assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para remocao`);

  lastResponse = await api().delete(`/students/${student.id}`);
  assert.equal(lastResponse.status, 204);
});

Then('deve existir {int} aluno cadastrado', async (quantity: number) => {
  const listResponse = await api().get('/students');
  assert.equal(listResponse.status, 200);
  assert.equal((listResponse.body as Student[]).length, quantity);
});

Then(
  'deve existir {int} alunos cadastrados',
  async (quantity: number) => {
    const listResponse = await api().get('/students');
    assert.equal(listResponse.status, 200);
    assert.equal((listResponse.body as Student[]).length, quantity);
  },
);

Then(
  'o aluno de cpf {string} deve ter nome {string} e email {string}',
  async (cpf: string, name: string, email: string) => {
    const listResponse = await api().get('/students');
    assert.equal(listResponse.status, 200);

    const student = (listResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado na listagem`);
    assert.equal(student.name, name);
    assert.equal(student.email, email);
  },
);

When(
  'eu defino a avaliacao do aluno de cpf {string} na meta {string} com conceito {string}',
  async (cpf: string, goal: string, concept: string) => {
    const listResponse = await api().get('/students');
    assert.equal(listResponse.status, 200);

    const student = (listResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para avaliacao`);

    lastResponse = await api()
      .put(`/students/${student.id}/evaluations`)
      .send({ goal, concept });

    assert.equal(lastResponse.status, 200);
  },
);

Then(
  'o aluno de cpf {string} deve ter conceito {string} na meta {string}',
  async (cpf: string, concept: string, goal: string) => {
    const studentResponse = await api().get('/students');
    assert.equal(studentResponse.status, 200);

    const student = (studentResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para verificacao de avaliacao`);

    const evaluationsResponse = await api().get('/evaluations');
    assert.equal(evaluationsResponse.status, 200);

    const table = evaluationsResponse.body as EvaluationResponse;
    const row = table.rows.find((item) => item.studentId === student.id);
    assert.ok(row, `Linha de avaliacao para aluno ${student.id} nao encontrada`);
    assert.equal(row.evaluations[goal], concept);
  },
);

When(
  'eu cadastro a turma {string} no ano {int} semestre {int} com os alunos {string}',
  async (topic: string, year: number, semester: number, cpfsCsv: string) => {
    const cpfs = cpfsCsv.split(',').map((item) => item.trim()).filter(Boolean);
    const studentsResponse = await api().get('/students');
    assert.equal(studentsResponse.status, 200);

    const students = studentsResponse.body as Student[];
    const studentIds = cpfs.map((cpf) => {
      const student = students.find((item) => item.cpf === cpf);
      assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para matricula`);
      return student.id;
    });

    lastResponse = await api().post('/classes').send({
      topic,
      year,
      semester,
      studentIds,
    });

    assert.equal(lastResponse.status, 201);
  },
);

When(
  'eu defino na turma {string} a avaliacao do aluno {string} na meta {string} com conceito {string}',
  async (topic: string, cpf: string, goal: string, concept: string) => {
    const classesResponse = await api().get('/classes');
    assert.equal(classesResponse.status, 200);
    const schoolClass = (classesResponse.body as SchoolClass[]).find((item) => item.topic === topic);
    assert.ok(schoolClass, `Turma ${topic} nao encontrada`);

    const studentsResponse = await api().get('/students');
    assert.equal(studentsResponse.status, 200);
    const student = (studentsResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para avaliacao em turma`);

    lastResponse = await api()
      .put(`/classes/${schoolClass.id}/evaluations`)
      .send({ studentId: student.id, goal, concept });

    assert.equal(lastResponse.status, 200);
  },
);

Then(
  'a turma {string} deve conter o aluno {string} com conceito {string} na meta {string}',
  async (topic: string, cpf: string, concept: string, goal: string) => {
    const classesResponse = await api().get('/classes');
    assert.equal(classesResponse.status, 200);
    const schoolClass = (classesResponse.body as SchoolClass[]).find((item) => item.topic === topic);
    assert.ok(schoolClass, `Turma ${topic} nao encontrada para verificacao`);

    const detailResponse = await api().get(`/classes/${schoolClass.id}`);
    assert.equal(detailResponse.status, 200);

    const detail = detailResponse.body as ClassDetailResponse;
    const row = detail.rows.find((item) => item.cpf === cpf);
    assert.ok(row, `Aluno ${cpf} nao encontrado nos detalhes da turma`);
    assert.equal(row.evaluations[goal], concept);
  },
);

Then(
  'deve existir {int} email enviado hoje para o aluno de cpf {string}',
  async (quantity: number, cpf: string) => {
    const studentsResponse = await api().get('/students');
    assert.equal(studentsResponse.status, 200);

    const student = (studentsResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para verificar emails`);

    const emailsResponse = await api().get('/emails').query({ studentId: student.id, date: today() });
    assert.equal(emailsResponse.status, 200);

    const emails = emailsResponse.body as EmailMessage[];
    assert.equal(emails.length, quantity);
  },
);

Then(
  'o email diario do aluno de cpf {string} deve conter os textos {string} e {string}',
  async (cpf: string, textA: string, textB: string) => {
    const studentsResponse = await api().get('/students');
    assert.equal(studentsResponse.status, 200);

    const student = (studentsResponse.body as Student[]).find((item) => item.cpf === cpf);
    assert.ok(student, `Aluno com cpf ${cpf} nao encontrado para verificar conteudo do email`);

    const emailsResponse = await api().get('/emails').query({ studentId: student.id, date: today() });
    assert.equal(emailsResponse.status, 200);

    const emails = emailsResponse.body as EmailMessage[];
    assert.ok(emails.length > 0, 'Nenhum email diario encontrado para o aluno');

    const body = emails[0].body;
    assert.ok(body.includes(textA), `Email nao contem texto esperado: ${textA}`);
    assert.ok(body.includes(textB), `Email nao contem texto esperado: ${textB}`);
  },
);
