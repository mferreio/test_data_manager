"""
TDM Client - Cliente Python para automação de testes com Selenium

Este cliente permite integrar o sistema de gerenciamento de massas de teste
com seus scripts de automação Selenium/Python.

Instalação:
    pip install requests

Uso básico:
    from tdm_client import TDMClient
    
    # Criar cliente (use a URL do seu deploy)
    tdm = TDMClient("https://seu-app.onrender.com")
    
    # Buscar massa disponível
    massa = tdm.get_available_massa(doc_type="CPF")
    
    # Usar no teste...
    
    # Liberar após uso
    tdm.release_massa(massa["id"])
"""

import requests
import os
from typing import Optional, Dict, List, Any


class TDMClient:
    """
    Cliente para o sistema de Gerenciamento de Massas de Teste (TDM).
    
    Attributes:
        api_url: URL base da API do TDM
        timeout: Timeout padrão para requisições (segundos)
    """
    
    def __init__(self, api_url: str = None, timeout: int = 30):
        """
        Inicializa o cliente TDM.
        
        Args:
            api_url: URL da API. Se não fornecida, usa a variável de ambiente 
                     TDM_API_URL ou https://tdm-api-vn0v.onrender.com como fallback.
            timeout: Timeout para requisições em segundos.
        """
        self.api_url = api_url or os.getenv("TDM_API_URL", "https://tdm-api-vn0v.onrender.com")
        self.timeout = timeout
        self._session = requests.Session()
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        """Faz uma requisição HTTP para a API."""
        url = f"{self.api_url}{endpoint}"
        kwargs.setdefault("timeout", self.timeout)
        
        try:
            response = self._session.request(method, url, **kwargs)
            response.raise_for_status()
            
            if response.text:
                return response.json()
            return None
        except requests.exceptions.RequestException as e:
            print(f"[TDM] Erro na requisição: {e}")
            raise
    
    # ==================== MÉTODOS DE BUSCA ====================
    
    def get_all_massas(self) -> List[Dict]:
        """Retorna todas as massas cadastradas."""
        return self._request("GET", "/massas")
    
    def get_massa_by_id(self, massa_id: int) -> Optional[Dict]:
        """Busca uma massa específica pelo ID."""
        return self._request("GET", f"/massas/{massa_id}")
    
    def search_massas(
        self,
        status: str = None,
        region: str = None,
        document_type: str = None,
        tags: List[str] = None
    ) -> List[Dict]:
        """
        Busca massas com filtros específicos.
        
        Args:
            status: Filtrar por status (AVAILABLE, IN_USE, BLOCKED, CONSUMED)
            region: Filtrar por região (sudeste, nordeste, etc.)
            document_type: Filtrar por tipo (CPF ou CNPJ)
            tags: Filtrar por tags
            
        Returns:
            Lista de massas que atendem aos critérios
        """
        params = {}
        if status:
            params["status"] = status
        if region:
            params["region"] = region
        if document_type:
            params["document_type"] = document_type
        if tags:
            params["tags"] = ",".join(tags)
        
        return self._request("GET", "/massas", params=params)
    
    # ==================== MÉTODOS DE RESERVA ====================
    
    def get_available_massa(
        self,
        region: str = None,
        doc_type: str = None,
        tags: List[str] = None,
        auto_reserve: bool = True
    ) -> Optional[Dict]:
        """
        Busca e reserva automaticamente uma massa disponível.
        
        Esta é a principal função para uso em testes automatizados.
        Ela busca a primeira massa disponível que atende aos critérios
        e a marca como IN_USE automaticamente.
        
        Args:
            region: Região desejada (opcional)
            doc_type: Tipo de documento - "CPF" ou "CNPJ" (opcional)
            tags: Tags que a massa deve ter (opcional)
            auto_reserve: Se True, marca automaticamente como IN_USE
            
        Returns:
            Dicionário com dados da massa ou None se não encontrar
            
        Example:
            >>> massa = tdm.get_available_massa(doc_type="CPF")
            >>> print(f"CPF: {massa['document_number']}")
        """
        massas = self.search_massas(
            status="AVAILABLE",
            region=region,
            document_type=doc_type,
            tags=tags
        )
        
        if not massas:
            print("[TDM] Nenhuma massa disponível encontrada com os critérios especificados")
            return None
        
        massa = massas[0]
        
        if auto_reserve:
            self.update_status(massa["id"], "IN_USE")
            print(f"[TDM] Massa #{massa['id']} reservada com sucesso")
        
        return massa
    
    def reserve_massa(self, massa_id: int, reserved_for: str = None) -> bool:
        """
        Reserva uma massa específica para uso.
        
        Args:
            massa_id: ID da massa a reservar
            reserved_for: Identificador de quem está reservando (opcional)
            
        Returns:
            True se reservada com sucesso, False caso contrário
        """
        try:
            data = {"status": "IN_USE"}
            if reserved_for:
                data["reserved_for"] = reserved_for
                
            self._request("PUT", f"/massas/{massa_id}", json=data)
            return True
        except Exception:
            return False
    
    # ==================== MÉTODOS DE ATUALIZAÇÃO ====================
    
    def update_status(self, massa_id: int, status: str) -> bool:
        """
        Atualiza o status de uma massa.
        
        Args:
            massa_id: ID da massa
            status: Novo status (AVAILABLE, IN_USE, BLOCKED, CONSUMED)
            
        Returns:
            True se atualizado com sucesso
        """
        try:
            self._request("PUT", f"/massas/{massa_id}", json={"status": status})
            return True
        except Exception:
            return False
    
    def release_massa(self, massa_id: int) -> bool:
        """
        Libera uma massa após o uso, marcando como AVAILABLE.
        
        Use esta função no teardown do seu teste para devolver
        a massa ao pool disponível.
        
        Args:
            massa_id: ID da massa a liberar
            
        Returns:
            True se liberada com sucesso
        """
        success = self.update_status(massa_id, "AVAILABLE")
        if success:
            print(f"[TDM] Massa #{massa_id} liberada com sucesso")
        return success
    
    def consume_massa(self, massa_id: int) -> bool:
        """
        Marca uma massa como consumida (não pode mais ser usada).
        
        Use quando o dado foi alterado permanentemente no sistema
        de destino e não pode ser reutilizado.
        
        Args:
            massa_id: ID da massa a consumir
            
        Returns:
            True se consumida com sucesso
        """
        success = self.update_status(massa_id, "CONSUMED")
        if success:
            print(f"[TDM] Massa #{massa_id} marcada como consumida")
        return success
    
    def block_massa(self, massa_id: int, reason: str = None) -> bool:
        """
        Bloqueia uma massa (ex: dados inválidos, problema detectado).
        
        Args:
            massa_id: ID da massa a bloquear
            reason: Motivo do bloqueio (opcional)
            
        Returns:
            True se bloqueada com sucesso
        """
        data = {"status": "BLOCKED"}
        if reason:
            data["status_obs"] = reason
            
        try:
            self._request("PUT", f"/massas/{massa_id}", json=data)
            print(f"[TDM] Massa #{massa_id} bloqueada")
            return True
        except Exception:
            return False
    
    # ==================== MÉTODOS DE CRIAÇÃO ====================
    
    def create_massa(self, data: Dict) -> Optional[Dict]:
        """
        Cria uma nova massa no sistema.
        
        Args:
            data: Dicionário com dados da massa:
                - nome: Nome do titular
                - document_number: Número do documento
                - document_type: "CPF" ou "CNPJ"
                - region: Região (opcional)
                - status: Status inicial (default: AVAILABLE)
                - tags: Lista de tags (opcional)
                
        Returns:
            Dicionário com a massa criada ou None se falhar
        """
        return self._request("POST", "/massas", json=data)
    
    # ==================== CONTEXT MANAGER ====================
    
    def __enter__(self):
        """Permite uso com 'with' statement."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Fecha a sessão ao sair do context manager."""
        self._session.close()


# ==================== CLASSE HELPER PARA TESTES ====================

class TDMMassaContext:
    """
    Context Manager para uso automático de massa em testes.
    
    Automaticamente reserva uma massa no início e libera no final,
    mesmo se o teste falhar.
    
    Example:
        with TDMMassaContext(tdm, doc_type="CPF") as massa:
            driver.find_element("id", "cpf").send_keys(massa["document_number"])
            # ... resto do teste
        # Massa liberada automaticamente
    """
    
    def __init__(self, client: TDMClient, **search_kwargs):
        self.client = client
        self.search_kwargs = search_kwargs
        self.massa = None
    
    def __enter__(self) -> Optional[Dict]:
        self.massa = self.client.get_available_massa(**self.search_kwargs)
        return self.massa
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.massa:
            self.client.release_massa(self.massa["id"])


# ==================== EXEMPLO DE USO ====================

if __name__ == "__main__":
    # Exemplo de uso básico
    print("=== TDM Client - Exemplo de Uso ===\n")
    
    # Inicializar cliente
    tdm = TDMClient()  # Usa localhost:8000 por padrão
    
    print(f"Conectado a: {tdm.api_url}")
    
    # Buscar todas as massas
    try:
        massas = tdm.get_all_massas()
        print(f"Total de massas: {len(massas)}")
        
        # Buscar massa disponível
        massa = tdm.get_available_massa(doc_type="CPF", auto_reserve=False)
        
        if massa:
            print(f"\nMassa encontrada:")
            print(f"  ID: {massa['id']}")
            print(f"  Nome: {massa.get('nome', 'N/A')}")
            print(f"  Documento: {massa['document_number']}")
            print(f"  Tipo: {massa['document_type']}")
            print(f"  Status: {massa['status']}")
        else:
            print("\nNenhuma massa CPF disponível")
            
    except Exception as e:
        print(f"Erro: {e}")
        print("Certifique-se que o servidor está rodando em http://127.0.0.1:8000")
