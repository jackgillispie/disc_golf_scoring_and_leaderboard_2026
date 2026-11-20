#This project is a disk golf scoring application built to run with 
Google Apps Script and Netlify. The front-end web app is defined
in Google Apps Script, as is the backend receiving data. There is an 
optional proxy defined that can be used in Netlify. 

Currently, users are given a valid QR code (read: a specific URL) to 
submit scores at. The backend allows for score correction if needed. 
Historically, only one person out of 50 has had issues.

#The business value this app provides is
- User engagement with vendor brands via the app
- Improved user experience as a game player (i.e the app is better than pencil/paper scoring)

#These are some initiatives we will be working on in future pull requests: 
##General improvements for correctness/robustness
- Rewriting functions to be unit-testable in dev
- CI/CD for security checks
- Tests to verify data passes correctly and failure modes are well-defined
- Identify edge cases / corner cases 

##Cleaner interface for admin score management
- either as a separate web app or a user-friendly interface in the sheets backend

##Adaptable 'versions' for different courses and games (i.e. golf vs disc golf)
- Possibly an API that pulls in course info relevant to par, topology, etc

##Well defined registration method for event creation in wix
- Users register for event, get a QR code corresponding to a login identifier

##More professional auth
- urlparams were sufficient for the first draft, but actual login method would
be better for robust authentication/authorization for score input

##More specific user / vendor matchup insight and logic 
- The idea is we can define where vendors and users are at a given point in time 
on the course, and provide updates to both to recommend each other as prospective
partners
