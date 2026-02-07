from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime
from sqlalchemy.sql import func
from .database import Base
import datetime

class Massa(Base):
    __tablename__ = "massas"

    id = Column(Integer, primary_key=True, index=True)
    document_type = Column(String, index=True) # CPF, CNPJ
    document_number = Column(String, unique=True, index=True)
    nome = Column(String, index=True, nullable=True)
    
    # Filtering Criteria
    region = Column(String, index=True) # NE, SE, S, N, CO
    uf = Column(String, index=True) # State code if needed
    
    # Statuses
    status = Column(String, default="AVAILABLE", index=True) # AVAILABLE, IN_USE, CONSUMED, BLOCKED
    financial_status = Column(String) # ADIMPLENTE, INADIMPLENTE, ACORDO
    
    # UC Counts - multiple UCs per massa
    uc_ligada = Column(Integer, default=0)
    uc_desligada = Column(Integer, default=0)
    uc_suspensa = Column(Integer, default=0)
    
    # Invoice Counts - multiple invoice types per massa
    fat_vencidas = Column(Integer, default=0)
    fat_a_vencer = Column(Integer, default=0)
    fat_pagas = Column(Integer, default=0)
    fat_boleto_unico = Column(Integer, default=0)
    fat_multifaturas = Column(Integer, default=0)
    fat_renegociacao = Column(Integer, default=0)
    
    # Specific attributes user mentioned
    tags = Column(JSON, default=[]) # ["leitura_grupo_b", "baixa_renda", "vencida_365"]
    metadata_info = Column(JSON, default={}) # Flexible field for extra details
    
    # Tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    last_used_by = Column(String, nullable=True) # Session ID or Test Name
