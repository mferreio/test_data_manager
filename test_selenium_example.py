"""
Exemplo de uso do TDM Client com Selenium

Este arquivo demonstra como integrar o sistema de gerenciamento de massas
com seus testes automatizados usando Selenium.

Instalação das dependências:
    pip install selenium requests webdriver-manager

Configuração:
    1. Configure a variável TDM_API_URL para apontar para seu servidor TDM
    2. Ou passe a URL diretamente para o TDMClient
"""

import os
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Importar o cliente TDM (está no mesmo diretório)
from tdm_client import TDMClient, TDMMassaContext


# ==================== CONFIGURAÇÃO ====================

# URL da API TDM (altere para seu deploy no Render)
TDM_API_URL = os.getenv("TDM_API_URL", "http://127.0.0.1:8000")

# URL do sistema sendo testado
TARGET_URL = os.getenv("TARGET_URL", "https://seu-sistema.com")


# ==================== FIXTURES ====================

@pytest.fixture(scope="session")
def tdm_client():
    """Fixture para cliente TDM reutilizável na sessão."""
    return TDMClient(TDM_API_URL)


@pytest.fixture(scope="function")
def driver():
    """Fixture para criar e destruir o WebDriver."""
    # Configurar Chrome
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    # options.add_argument("--headless")  # Descomente para rodar sem interface
    
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(10)
    
    yield driver
    
    driver.quit()


@pytest.fixture(scope="function")
def massa_cpf(tdm_client):
    """
    Fixture que fornece uma massa CPF disponível.
    Libera automaticamente após o teste.
    """
    massa = tdm_client.get_available_massa(doc_type="CPF")
    
    if not massa:
        pytest.skip("Nenhuma massa CPF disponível no TDM")
    
    yield massa
    
    # Cleanup: liberar massa após o teste
    tdm_client.release_massa(massa["id"])


@pytest.fixture(scope="function")
def massa_cnpj(tdm_client):
    """
    Fixture que fornece uma massa CNPJ disponível.
    Libera automaticamente após o teste.
    """
    massa = tdm_client.get_available_massa(doc_type="CNPJ")
    
    if not massa:
        pytest.skip("Nenhuma massa CNPJ disponível no TDM")
    
    yield massa
    
    # Cleanup: liberar massa após o teste
    tdm_client.release_massa(massa["id"])


# ==================== TESTES ====================

class TestLoginComCPF:
    """Testes de login usando massas com CPF."""
    
    def test_login_cpf_valido(self, driver, massa_cpf):
        """
        Testa login com um CPF válido do banco de massas.
        """
        print(f"\n[TEST] Usando massa #{massa_cpf['id']}: {massa_cpf['document_number']}")
        
        # Navegar para a página de login
        driver.get(f"{TARGET_URL}/login")
        
        # Preencher formulário de login
        campo_cpf = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "cpf"))
        )
        campo_cpf.send_keys(massa_cpf["document_number"])
        
        # Se houver campo de nome
        campo_nome = driver.find_element(By.ID, "nome")
        campo_nome.send_keys(massa_cpf.get("nome", "Teste Automatizado"))
        
        # Clicar no botão de login
        btn_login = driver.find_element(By.ID, "btn-login")
        btn_login.click()
        
        # Verificar redirecionamento para dashboard
        WebDriverWait(driver, 10).until(
            EC.url_contains("/dashboard")
        )
        
        assert "/dashboard" in driver.current_url


class TestCadastroPJ:
    """Testes de cadastro de pessoa jurídica."""
    
    def test_cadastro_empresa(self, driver, massa_cnpj):
        """
        Testa cadastro de empresa usando CNPJ do banco de massas.
        """
        print(f"\n[TEST] Usando massa #{massa_cnpj['id']}: {massa_cnpj['document_number']}")
        
        driver.get(f"{TARGET_URL}/cadastro-empresa")
        
        # Preencher CNPJ
        driver.find_element(By.ID, "cnpj").send_keys(massa_cnpj["document_number"])
        driver.find_element(By.ID, "razao-social").send_keys(
            massa_cnpj.get("nome", "Empresa Teste LTDA")
        )
        
        # Submeter formulário
        driver.find_element(By.ID, "btn-cadastrar").click()
        
        # Verificar sucesso
        msg_sucesso = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "success-message"))
        )
        
        assert "sucesso" in msg_sucesso.text.lower()


class TestComContextManager:
    """
    Exemplo usando Context Manager para gerenciar massa automaticamente.
    """
    
    def test_usando_context_manager(self, driver, tdm_client):
        """
        Demonstra uso do TDMMassaContext para gerenciamento automático.
        """
        # A massa é reservada automaticamente ao entrar no 'with'
        # e liberada automaticamente ao sair, mesmo se houver erro
        with TDMMassaContext(tdm_client, doc_type="CPF", region="sudeste") as massa:
            if not massa:
                pytest.skip("Nenhuma massa disponível")
            
            print(f"\n[TEST] Massa automática: {massa['document_number']}")
            
            driver.get(f"{TARGET_URL}/consulta")
            driver.find_element(By.ID, "cpf").send_keys(massa["document_number"])
            driver.find_element(By.ID, "btn-consultar").click()
            
            # Verificações...
            resultado = driver.find_element(By.ID, "resultado")
            assert resultado.is_displayed()


# ==================== EXEMPLO DE USO SEM PYTEST ====================

def exemplo_simples():
    """
    Exemplo simples de uso sem pytest.
    Execute diretamente: python test_selenium_example.py
    """
    print("=== Exemplo Simples de Uso ===\n")
    
    # 1. Inicializar cliente TDM
    tdm = TDMClient(TDM_API_URL)
    print(f"Conectado ao TDM: {tdm.api_url}")
    
    # 2. Buscar massa disponível
    massa = tdm.get_available_massa(doc_type="CPF")
    
    if not massa:
        print("Nenhuma massa disponível!")
        return
    
    print(f"Massa reservada: #{massa['id']} - {massa['document_number']}")
    
    # 3. Usar no Selenium
    try:
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        driver = webdriver.Chrome(options=options)
        
        # Simular uso (substitua pela sua lógica)
        driver.get("https://www.google.com")
        print(f"Título da página: {driver.title}")
        
        driver.quit()
        
    except Exception as e:
        print(f"Erro no Selenium: {e}")
    
    finally:
        # 4. IMPORTANTE: Sempre liberar a massa após uso
        tdm.release_massa(massa["id"])
        print("Massa liberada com sucesso!")


if __name__ == "__main__":
    exemplo_simples()
