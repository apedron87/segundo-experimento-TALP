import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

type Concept = 'MANA' | 'MPA' | 'MA'

interface Student {
  id: string
  name: string
  cpf: string
  email: string
}

interface StudentForm {
  name: string
  cpf: string
  email: string
}

interface EvaluationRow {
  studentId: string
  name: string
  evaluations: Record<string, Concept>
}

interface EvaluationTableResponse {
  goals: string[]
  rows: EvaluationRow[]
}

const EMPTY_FORM: StudentForm = {
  name: '',
  cpf: '',
  email: '',
}

const CONCEPT_OPTIONS: Concept[] = ['MANA', 'MPA', 'MA']
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const readErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string }
  return body.message ?? fallback
}

const fetchStudents = async (): Promise<Student[]> => {
  const response = await fetch(`${API_URL}/students`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Nao foi possivel carregar os alunos.'))
  }

  return (await response.json()) as Student[]
}

const fetchEvaluationTable = async (): Promise<EvaluationTableResponse> => {
  const response = await fetch(`${API_URL}/evaluations`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Nao foi possivel carregar as avaliacoes.'))
  }

  return (await response.json()) as EvaluationTableResponse
}

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStudents = async () => {
    setLoading(true)
    setError(null)

    try {
      setStudents(await fetchStudents())
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const firstLoad = async () => {
      try {
        const data = await fetchStudents()
        if (active) {
          setStudents(data)
        }
      } catch (requestError) {
        if (active) {
          setError((requestError as Error).message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void firstLoad()
    return () => {
      active = false
    }
  }, [])

  const updateField = (field: keyof StudentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const clearForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const submitStudent = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const endpoint = editingId ? `${API_URL}/students/${editingId}` : `${API_URL}/students`
    const method = editingId ? 'PUT' : 'POST'

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel salvar o aluno.'))
      return
    }

    await loadStudents()
    clearForm()
  }

  const removeStudent = async (id: string) => {
    setError(null)
    const response = await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel remover o aluno.'))
      return
    }

    await loadStudents()
    if (editingId === id) {
      clearForm()
    }
  }

  const startEditing = (student: Student) => {
    setEditingId(student.id)
    setForm({ name: student.name, cpf: student.cpf, email: student.email })
  }

  return (
    <>
      <h1>Gerenciamento de alunos</h1>

      <form className="student-form" onSubmit={submitStudent}>
        <label>
          Nome
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Nome do aluno"
            required
          />
        </label>
        <label>
          CPF
          <input
            value={form.cpf}
            onChange={(event) => updateField('cpf', event.target.value)}
            placeholder="CPF"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="email@exemplo.com"
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit">{editingId ? 'Salvar alteracao' : 'Cadastrar aluno'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={clearForm}>
              Cancelar edicao
            </button>
          )}
        </div>
      </form>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback">Carregando alunos...</p>}

      <section className="student-list">
        <h2>Alunos cadastrados</h2>
        {students.length === 0 ? (
          <p>Nenhum aluno cadastrado.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Email</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.cpf}</td>
                  <td>{student.email}</td>
                  <td className="actions">
                    <button type="button" className="secondary" onClick={() => startEditing(student)}>
                      Alterar
                    </button>
                    <button type="button" className="danger" onClick={() => void removeStudent(student.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function EvaluationsPage() {
  const [goals, setGoals] = useState<string[]>([])
  const [rows, setRows] = useState<EvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const loadTable = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchEvaluationTable()
      setGoals(data.goals)
      setRows(data.rows)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const firstLoad = async () => {
      try {
        const data = await fetchEvaluationTable()
        if (active) {
          setGoals(data.goals)
          setRows(data.rows)
        }
      } catch (requestError) {
        if (active) {
          setError((requestError as Error).message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void firstLoad()
    return () => {
      active = false
    }
  }, [])

  const updateEvaluation = async (studentId: string, goal: string, concept: Concept) => {
    setUpdatingKey(`${studentId}:${goal}`)
    setError(null)

    const response = await fetch(`${API_URL}/students/${studentId}/evaluations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, concept }),
    })

    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel atualizar a avaliacao.'))
      setUpdatingKey(null)
      return
    }

    setRows((current) =>
      current.map((row) =>
        row.studentId === studentId
          ? { ...row, evaluations: { ...row.evaluations, [goal]: concept } }
          : row,
      ),
    )
    setUpdatingKey(null)
  }

  return (
    <>
      <h1>Avaliacoes por metas</h1>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback">Carregando avaliacoes...</p>}

      <section className="student-list">
        <h2>Tabela de avaliacoes</h2>
        {rows.length === 0 ? (
          <p>Nao ha alunos cadastrados para avaliar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                {goals.map((goal) => (
                  <th key={goal}>{goal}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td>{row.name}</td>
                  {goals.map((goal) => {
                    const key = `${row.studentId}:${goal}`
                    return (
                      <td key={goal}>
                        <select
                          value={row.evaluations[goal] ?? 'MANA'}
                          disabled={updatingKey === key}
                          onChange={(event) =>
                            void updateEvaluation(
                              row.studentId,
                              goal,
                              event.target.value as Concept,
                            )}
                        >
                          {CONCEPT_OPTIONS.map((concept) => (
                            <option key={concept} value={concept}>
                              {concept}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="form-actions">
        <button type="button" className="secondary" onClick={() => void loadTable()}>
          Atualizar tabela
        </button>
      </div>
    </>
  )
}

function App() {
  return (
    <main className="page">
      <nav className="top-nav">
        <NavLink
          to="/students"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Alunos
        </NavLink>
        <NavLink
          to="/evaluations"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Avaliacoes
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/students" replace />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/evaluations" element={<EvaluationsPage />} />
      </Routes>
    </main>
  )
}

export default App
