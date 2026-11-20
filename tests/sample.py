import requests
"""
response = requests.post(
"https://api.airtable.com/v0/app9xCLKeFxrc31bQ/tblWLOkV2zYmp4NDI",
headers= {"Content-Type": "application/json", "Authorization": "Bearer REDACTED_AIRTABLE_TOKEN"},
json= {
    "fields": {
    "Tournament": "Python",
    "Group": "Group",
    "Players": "Players",
    "Hole": 1,
    "Par": 1,
    "Score": 1,
    "VsPar": 0,
    "Timestamp": "2026-04-24T05:56:47.114Z"}
         }
)

"""



response = requests.post(
"https://script.google.com/macros/s/AKfycbxinZ6rj0aIGTl34BR8Ydr__fZxqpallK0S2NBkYbOPQtJYpBFtVHmTfv-lULg5bVmX0A/exec",
headers= {"Content-Type": "text/plain;charset=utf-8", "Sec-Fetch-Mode": "cors"}, 
json= {
        "Tournament": "Python3",
        "Group": "Group",
        "Players": "Players",
        "Hole": 1,
        "Par": 1,
        "Score": 1,
        "VsPar": 0,
        "Timestamp": "2026-04-24T05:56:47.114Z",
        "Token": "card08-h5u4"
    }
)

print(response.json())

"""
response = requests.post(
"http://localhost:8888/.netlify/functions/save-score",
headers= {"Content-Type": "application/json", "Authorization": "Bearer REDACTED_AIRTABLE_TOKEN"},
json= {
        "fields": {
        "Tournament": "Python3",
        "Group": "Group",
        "Players": "Players",
        "Hole": 1,
        "Par": 1,
        "Score": 1,
        "VsPar": 0,
        "Timestamp": "2026-04-24T05:56:47.114Z"

        }
    }
)
"""

# print(response.request.body, response.status_code, response.headers, response.json())
