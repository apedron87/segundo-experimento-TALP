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
