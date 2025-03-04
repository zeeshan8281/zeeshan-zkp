recordId":"7a3y21a9"

curl -X POST http://localhost:3000/api/submit-basic-info \
 -H "Content-Type: application/json" \
 -d '{
"patientAge": 31,
"departmentId": 5,
"admissionDate": 1708752000
}'

curl -X POST http://localhost:3000/api/update-medical-record/wucugs51 \
 -H "Content-Type: application/json" \
 -d '{
"conditionSeverity": 2,
"dischargeDate": 1708848000,
"doctorId": 101,
"treatmentCode": 4501
}'

curl -X GET http://localhost:3000/api/verify/9sc4bt03
