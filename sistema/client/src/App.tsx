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

interface SchoolClass {
  id: string
  topic: string
  year: number
  semester: number
  studentIds: string[]
}

interface ClassForm {
  topic: string
  year: string
  semester: string
  studentIds: string[]
}

interface ClassDetailRow {
  studentId: string
  name: string
  cpf: string
  email: string
  evaluations: Record<string, Concept>
}

interface ClassDetail {
  id: string
  topic: string
  year: number
  semester: number
  goals: string[]
  rows: ClassDetailRow[]
}

const EMPTY_STUDENT_FORM: StudentForm = { name: '', cpf: '', email: '' }
const EMPTY_CLASS_FORM: ClassForm = { topic: '', year: '', semester: '1', studentIds: [] }
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

const fetchClasses = async (): Promise<SchoolClass[]> => {
  const response = await fetch(`${API_URL}/classes`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Nao foi possivel carregar as turmas.'))
  }
  return (await response.json()) as SchoolClass[]
}

const fetchClassDetail = async (id: string): Promise<ClassDetail> => {
  const response = await fetch(`${API_URL}/classes/${id}`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Nao foi possivel carregar os detalhes da turma.'))
  }
  return (await response.json()) as ClassDetail
}

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [form, setForm] = useState<StudentForm>(EMPTY_STUDENT_FORM)
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
    setForm(EMPTY_STUDENT_FORM)
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
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </label>
        <label>
          CPF
          <input value={form.cpf} onChange={(event) => updateField('cpf', event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
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
        row.studentId === studentId ? { ...row, evaluations: { ...row.evaluations, [goal]: concept } } : row,
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
                          onChange={(event) => void updateEvaluation(row.studentId, goal, event.target.value as Concept)}
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

function ClassesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [form, setForm] = useState<ClassForm>(EMPTY_CLASS_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedClassDetail, setSelectedClassDetail] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const loadBaseData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsData, classesData] = await Promise.all([fetchStudents(), fetchClasses()])
      setStudents(studentsData)
      setClasses(classesData)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedClass = async (classId: string) => {
    setError(null)
    try {
      const detail = await fetchClassDetail(classId)
      setSelectedClassId(classId)
      setSelectedClassDetail(detail)
    } catch (requestError) {
      setError((requestError as Error).message)
    }
  }

  useEffect(() => {
    let active = true
    const firstLoad = async () => {
      try {
        const [studentsData, classesData] = await Promise.all([fetchStudents(), fetchClasses()])
        if (active) {
          setStudents(studentsData)
          setClasses(classesData)
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

  const updateClassField = (field: keyof Omit<ClassForm, 'studentIds'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleStudent = (studentId: string) => {
    setForm((current) => {
      const exists = current.studentIds.includes(studentId)
      return {
        ...current,
        studentIds: exists
          ? current.studentIds.filter((id) => id !== studentId)
          : [...current.studentIds, studentId],
      }
    })
  }

  const clearForm = () => {
    setEditingId(null)
    setForm(EMPTY_CLASS_FORM)
  }

  const submitClass = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const endpoint = editingId ? `${API_URL}/classes/${editingId}` : `${API_URL}/classes`
    const method = editingId ? 'PUT' : 'POST'
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: form.topic,
        year: Number(form.year),
        semester: Number(form.semester),
        studentIds: form.studentIds,
      }),
    })

    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel salvar a turma.'))
      return
    }

    await loadBaseData()

    const savedClass = (await response.json().catch(() => null)) as SchoolClass | null
    clearForm()
    if (savedClass) {
      await loadSelectedClass(savedClass.id)
    }
  }

  const removeClass = async (id: string) => {
    setError(null)
    const response = await fetch(`${API_URL}/classes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel remover a turma.'))
      return
    }

    await loadBaseData()
    if (selectedClassId === id) {
      setSelectedClassId(null)
      setSelectedClassDetail(null)
    }
    if (editingId === id) {
      clearForm()
    }
  }

  const startEditing = (schoolClass: SchoolClass) => {
    setEditingId(schoolClass.id)
    setForm({
      topic: schoolClass.topic,
      year: String(schoolClass.year),
      semester: String(schoolClass.semester),
      studentIds: [...schoolClass.studentIds],
    })
  }

  const updateClassEvaluation = async (
    classId: string,
    studentId: string,
    goal: string,
    concept: Concept,
  ) => {
    setUpdatingKey(`${classId}:${studentId}:${goal}`)
    setError(null)

    const response = await fetch(`${API_URL}/classes/${classId}/evaluations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, goal, concept }),
    })

    if (!response.ok) {
      setError(await readErrorMessage(response, 'Nao foi possivel atualizar a avaliacao da turma.'))
      setUpdatingKey(null)
      return
    }

    setSelectedClassDetail((current) => {
      if (!current || current.id !== classId) {
        return current
      }
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.studentId === studentId ? { ...row, evaluations: { ...row.evaluations, [goal]: concept } } : row,
        ),
      }
    })
    setUpdatingKey(null)
  }

  return (
    <>
      <h1>Gerenciamento de turmas</h1>

      <form className="class-form" onSubmit={submitClass}>
        <label>
          Topico
          <input value={form.topic} onChange={(event) => updateClassField('topic', event.target.value)} required />
        </label>
        <label>
          Ano
          <input
            type="number"
            min={2000}
            max={3000}
            value={form.year}
            onChange={(event) => updateClassField('year', event.target.value)}
            required
          />
        </label>
        <label>
          Semestre
          <select value={form.semester} onChange={(event) => updateClassField('semester', event.target.value)} required>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>

        <div className="student-checklist">
          <p>Alunos matriculados</p>
          {students.length === 0 ? (
            <p>Nenhum aluno cadastrado.</p>
          ) : (
            students.map((student) => (
              <label key={student.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.studentIds.includes(student.id)}
                  onChange={() => toggleStudent(student.id)}
                />
                {student.name} ({student.cpf})
              </label>
            ))
          )}
        </div>

        <div className="form-actions">
          <button type="submit">{editingId ? 'Salvar turma' : 'Cadastrar turma'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={clearForm}>
              Cancelar edicao
            </button>
          )}
        </div>
      </form>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback">Carregando turmas...</p>}

      <section className="student-list">
        <h2>Turmas cadastradas</h2>
        {classes.length === 0 ? (
          <p>Nenhuma turma cadastrada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Topico</th>
                <th>Ano</th>
                <th>Semestre</th>
                <th>Alunos</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((schoolClass) => (
                <tr key={schoolClass.id}>
                  <td>{schoolClass.topic}</td>
                  <td>{schoolClass.year}</td>
                  <td>{schoolClass.semester}</td>
                  <td>{schoolClass.studentIds.length}</td>
                  <td className="actions">
                    <button type="button" className="secondary" onClick={() => void loadSelectedClass(schoolClass.id)}>
                      Visualizar
                    </button>
                    <button type="button" className="secondary" onClick={() => startEditing(schoolClass)}>
                      Alterar
                    </button>
                    <button type="button" className="danger" onClick={() => void removeClass(schoolClass.id)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selectedClassDetail && (
        <section className="student-list">
          <h2>
            Turma: {selectedClassDetail.topic} ({selectedClassDetail.year}/{selectedClassDetail.semester})
          </h2>
          {selectedClassDetail.rows.length === 0 ? (
            <p>Esta turma nao possui alunos matriculados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  {selectedClassDetail.goals.map((goal) => (
                    <th key={goal}>{goal}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedClassDetail.rows.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.name}</td>
                    {selectedClassDetail.goals.map((goal) => {
                      const key = `${selectedClassDetail.id}:${row.studentId}:${goal}`
                      return (
                        <td key={goal}>
                          <select
                            value={row.evaluations[goal] ?? 'MANA'}
                            disabled={updatingKey === key}
                            onChange={(event) =>
                              void updateClassEvaluation(
                                selectedClassDetail.id,
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
      )}
    </>
  )
}

function App() {
  return (
    <main className="page">
      <nav className="top-nav">
        <NavLink to="/students" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Alunos
        </NavLink>
        <NavLink to="/evaluations" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Avaliacoes
        </NavLink>
        <NavLink to="/classes" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Turmas
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/students" replace />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/evaluations" element={<EvaluationsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
      </Routes>
    </main>
  )
}

export default App
