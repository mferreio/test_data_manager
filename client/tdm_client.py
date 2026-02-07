import requests
from typing import Optional, Dict, Any

class TDMClient:
    """
    Client utilizing the Test Data Management (TDM) API to fetch and manage test data.
    """
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')

    def get_available_massa(
        self, 
        region: Optional[str] = None, 
        uc_status: Optional[str] = None, 
        financial_status: Optional[str] = None,
        test_name: str = "automated_test"
    ) -> Dict[str, Any]:
        """
        Attempts to checkout (lock) a massa that matches criteria.
        Returns the massa dict if found, or raises Exception.
        """
        params = {"consumer_id": test_name}
        if region: params["region"] = region
        if uc_status: params["uc_status"] = uc_status
        if financial_status: params["financial_status"] = financial_status

        response = requests.post(f"{self.base_url}/massas/checkout", params=params)
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            raise ValueError(f"No available massa found for criteria: {params}")
        else:
            response.raise_for_status()

    def release_massa(self, massa_id: int, status: str = "AVAILABLE"):
        """
        Releases a massa back to the pool or marks it as CONSUMED.
        """
        params = {"new_status": status}
        response = requests.post(f"{self.base_url}/massas/{massa_id}/release", params=params)
        response.raise_for_status()

    def mark_as_consumed(self, massa_id: int):
        self.release_massa(massa_id, "CONSUMED")

    def mark_as_available(self, massa_id: int):
        self.release_massa(massa_id, "AVAILABLE")
        
# Example Usage:
if __name__ == "__main__":
    client = TDMClient()
    try:
        user = client.get_available_massa(region="NE", financial_status="ADIMPLENTE")
        print(f"Testing with User: {user['document_number']}")
        # ... Do test steps ...
        client.mark_as_consumed(user['id'])
        print("User marked as consumed.")
    except Exception as e:
        print(e)
