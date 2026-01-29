import requests
import json

try:
    response = requests.get('http://localhost:8000/api/reports/summary/')
    data = response.json()
    
    print(f"Status: {response.status_code}")
    print(f"Has country_breakdown: {'country_breakdown' in data}")
    
    if 'country_breakdown' in data:
        countries = data['country_breakdown']
        print(f"Number of countries: {len(countries)}")
        
        if countries:
            print("\nCountry breakdown:")
            for country, metrics in list(countries.items())[:5]:
                print(f"  {country}:")
                print(f"    Total Leads: {metrics.get('total_leads', 0)}")
                print(f"    Qualified: {metrics.get('qualified_leads', 0)}")
                print(f"    Applications: {metrics.get('applications_submitted', 0)}")
                print(f"    Enrolled: {metrics.get('enrolled', 0)}")
        else:
            print("  (empty breakdown)")
    else:
        print("ERROR: country_breakdown key missing from response!")
        
except Exception as e:
    print(f"Error: {e}")
