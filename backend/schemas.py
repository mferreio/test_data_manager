from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class MassaBase(BaseModel):
    nome: Optional[str] = None
    document_type: str
    document_number: str
    region: str
    uf: Optional[str] = None
    status: Optional[str] = "AVAILABLE"
    financial_status: Optional[str] = None
    # UC counts
    uc_ligada: Optional[int] = 0
    uc_desligada: Optional[int] = 0
    uc_suspensa: Optional[int] = 0
    # Invoice counts
    fat_vencidas: Optional[int] = 0
    fat_a_vencer: Optional[int] = 0
    fat_pagas: Optional[int] = 0
    fat_boleto_unico: Optional[int] = 0
    fat_multifaturas: Optional[int] = 0
    fat_renegociacao: Optional[int] = 0
    tags: List[str] = []
    metadata_info: Dict[str, Any] = {}

class MassaCreate(MassaBase):
    pass

class MassaUpdate(BaseModel):
    nome: Optional[str] = None
    status: Optional[str] = None
    financial_status: Optional[str] = None
    uc_ligada: Optional[int] = None
    uc_desligada: Optional[int] = None
    uc_suspensa: Optional[int] = None
    fat_vencidas: Optional[int] = None
    fat_a_vencer: Optional[int] = None
    fat_pagas: Optional[int] = None
    fat_boleto_unico: Optional[int] = None
    fat_multifaturas: Optional[int] = None
    fat_renegociacao: Optional[int] = None
    tags: Optional[List[str]] = None
    metadata_info: Optional[Dict[str, Any]] = None

class Massa(MassaBase):
    id: int
    created_at: Optional[datetime]
    last_used_at: Optional[datetime]
    last_used_by: Optional[str]

    class Config:
        from_attributes = True
