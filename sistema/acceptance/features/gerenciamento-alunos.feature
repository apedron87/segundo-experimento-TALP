# language: pt
Funcionalidade: Gerenciamento de alunos
  Como usuario do sistema
  Quero gerenciar os alunos cadastrados
  Para manter a lista de alunos atualizada

  Cenario: Cadastrar um novo aluno
    Dado que nao existem alunos cadastrados
    Quando eu cadastro um aluno com nome "Ana Silva", cpf "12345678900" e email "ana@escola.com"
    Entao deve existir 1 aluno cadastrado
    E o aluno de cpf "12345678900" deve ter nome "Ana Silva" e email "ana@escola.com"

  Cenario: Alterar um aluno existente
    Dado que nao existem alunos cadastrados
    E eu cadastro um aluno com nome "Carlos Lima", cpf "11122233344" e email "carlos@escola.com"
    Quando eu altero o aluno de cpf "11122233344" para nome "Carlos Lima Junior" e email "junior@escola.com"
    Entao o aluno de cpf "11122233344" deve ter nome "Carlos Lima Junior" e email "junior@escola.com"

  Cenario: Remover aluno
    Dado que nao existem alunos cadastrados
    E eu cadastro um aluno com nome "Marina Souza", cpf "99988877766" e email "marina@escola.com"
    Quando eu removo o aluno de cpf "99988877766"
    Entao deve existir 0 aluno cadastrado

  Cenario: Gerenciar avaliacao por meta
    Dado que nao existem alunos cadastrados
    E eu cadastro um aluno com nome "Pedro Alves", cpf "55544433322" e email "pedro@escola.com"
    Quando eu defino a avaliacao do aluno de cpf "55544433322" na meta "Requisitos" com conceito "MA"
    Entao o aluno de cpf "55544433322" deve ter conceito "MA" na meta "Requisitos"
