# TDM - Test Data Manager 🎯

Sistema de gerenciamento de massas de teste para automação com Selenium/Python.

![Status](https://img.shields.io/badge/status-ready-success)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/fastapi-latest-green)

## 📋 Índice

- [Sobre](#sobre)
- [Instalação Local](#instalação-local)
- [Deploy no Render](#deploy-no-render)
- [Uso em Automação](#uso-em-automação)
- [API Reference](#api-reference)

---

## 📖 Sobre

O TDM é um sistema completo para gerenciar massas de teste (CPF, CNPJ, dados de clientes) usado em automação de testes. Ele permite:

- ✅ Cadastrar e organizar massas de teste
- ✅ Buscar massas disponíveis por filtros (tipo, região, status, tags)
- ✅ Reservar massas para uso em testes
- ✅ Liberar massas após finalizar testes
- ✅ Importar massas de planilhas CSV/Excel
- ✅ Interface web moderna e responsiva

---

## 🖥️ Instalação Local

### Requisitos

- Python 3.11+
- pip

### Passos

1. **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/tdm.git
cd tdm
```

2. **Instale as dependências:**
```bash
pip install -r requirements.txt
```

3. **Execute o servidor:**
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

4. **Acesse a interface:**
   - Frontend: http://127.0.0.1:8000 (abre `frontend/index.html`)
   - API Docs: http://127.0.0.1:8000/docs

---

## 🚀 Deploy no Render (Gratuito)

### Opção 1: Deploy Automático (Recomendado)

1. Faça fork deste repositório no GitHub
2. Acesse [render.com](https://render.com) e crie uma conta
3. Clique em **New > Blueprint**
4. Conecte seu repositório GitHub
5. O Render lerá o `render.yaml` e criará os serviços automaticamente

### Opção 2: Deploy Manual

**Backend (API):**

1. No Render, crie um **Web Service**
2. Conecte seu repositório
3. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3

**Frontend:**

1. Crie um **Static Site**
2. Aponte para a pasta `/frontend`
3. Configure a variável `API_URL` com a URL do backend

### Após o Deploy

Sua aplicação estará disponível em:
- API: `https://tdm-api.onrender.com`
- Frontend: `https://tdm-frontend.onrender.com`

⚠️ **Nota:** No plano gratuito, o serviço "dorme" após 15 minutos de inatividade. A primeira requisição pode demorar ~30s.

---

## 🤖 Uso em Automação

### Instalação do Cliente

```bash
# Copie o arquivo tdm_client.py para seu projeto
# ou instale as dependências:
pip install requests
```

### Configuração

```python
import os
os.environ["TDM_API_URL"] = "https://seu-app.onrender.com"
```

### Uso Básico

```python
from tdm_client import TDMClient

# Inicializar cliente
tdm = TDMClient("https://seu-app.onrender.com")

# Buscar e reservar massa CPF
massa = tdm.get_available_massa(doc_type="CPF")

if massa:
    print(f"CPF: {massa['document_number']}")
    print(f"Nome: {massa['nome']}")
    
    # ... usar no teste ...
    
    # Liberar após uso
    tdm.release_massa(massa["id"])
```

### Com Selenium

```python
from selenium import webdriver
from tdm_client import TDMClient

tdm = TDMClient("https://seu-app.onrender.com")
driver = webdriver.Chrome()

# Buscar massa
massa = tdm.get_available_massa(doc_type="CPF")

try:
    driver.get("https://sistema-alvo.com/login")
    driver.find_element("id", "cpf").send_keys(massa["document_number"])
    driver.find_element("id", "senha").send_keys("senha123")
    driver.find_element("id", "btn-login").click()
    # ...
finally:
    # SEMPRE liberar a massa
    tdm.release_massa(massa["id"])
    driver.quit()
```

### Com Context Manager (Recomendado)

```python
from tdm_client import TDMClient, TDMMassaContext

tdm = TDMClient()

# Massa é liberada automaticamente ao sair do 'with'
with TDMMassaContext(tdm, doc_type="CPF") as massa:
    print(f"Usando: {massa['document_number']}")
    # ... teste ...
# Massa liberada automaticamente aqui
```

### Com Pytest Fixtures

```python
import pytest
from tdm_client import TDMClient

@pytest.fixture
def massa_cpf():
    tdm = TDMClient()
    massa = tdm.get_available_massa(doc_type="CPF")
    yield massa
    tdm.release_massa(massa["id"])

def test_login(driver, massa_cpf):
    driver.get("https://sistema.com/login")
    driver.find_element("id", "cpf").send_keys(massa_cpf["document_number"])
    # ...
```

---

## 📚 API Reference

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/massas` | Lista todas as massas |
| GET | `/massas?status=AVAILABLE` | Filtra por status |
| GET | `/massas?document_type=CPF` | Filtra por tipo |
| GET | `/massas/{id}` | Busca por ID |
| POST | `/massas` | Cria nova massa |
| PUT | `/massas/{id}` | Atualiza massa |
| DELETE | `/massas/{id}` | Remove massa |

### Status Disponíveis

| Status | Descrição |
|--------|-----------|
| `AVAILABLE` | Disponível para uso |
| `IN_USE` | Em uso por um teste |
| `BLOCKED` | Bloqueada (problema detectado) |
| `CONSUMED` | Consumida (não pode ser reutilizada) |

### Exemplo de Requisição

```bash
# Buscar massas disponíveis
curl "https://seu-app.onrender.com/massas?status=AVAILABLE&document_type=CPF"

# Atualizar status
curl -X PUT "https://seu-app.onrender.com/massas/1" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_USE"}'
```

---

## 📁 Estrutura do Projeto

```
tdm/
├── backend/
│   ├── main.py          # FastAPI app
│   ├── database.py      # SQLAlchemy models
│   └── schemas.py       # Pydantic schemas
├── frontend/
│   ├── index.html       # Interface web
│   ├── app.js           # Lógica JavaScript
│   └── style.css        # Estilos
├── tdm_client.py        # Cliente Python para automação
├── test_selenium_example.py  # Exemplos de testes
├── requirements.txt     # Dependências Python
├── render.yaml          # Configuração de deploy
└── README.md           # Este arquivo
```

---

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

**Desenvolvido com ❤️ para facilitar a automação de testes**
