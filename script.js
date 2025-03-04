const basicInfoForm = document.getElementById('basicInfoForm');
if (basicInfoForm) {
  basicInfoForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const patientAge = document.getElementById('patientAge').value;
    const departmentId = document.getElementById('departmentId').value;
    const admissionDate = document.getElementById('admissionDate').value;

    const data = {
      patientAge: parseInt(patientAge),
      departmentId: parseInt(departmentId),
      admissionDate: parseInt(admissionDate)
    };

    fetch('http://localhost:3000/api/submit-basic-info', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
      window.location.href = `update.html?recordId=${data.recordId}`;
    })
    .catch(error => {
      console.error('Error:', error);
    });
  });
}

// On update page load, populate record ID from URL
if (window.location.pathname.endsWith('update.html')) {
  const urlParams = new URLSearchParams(window.location.search);
  const recordId = urlParams.get('recordId');
  if (recordId) {
    document.getElementById('recordId').value = recordId;
  }
}

// Handle retrieve form submission
const retrieveForm = document.getElementById('retrieveForm');
if (retrieveForm) {
  retrieveForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const recordId = document.getElementById('retrieveRecordId').value;
    
    fetch(`http://localhost:3000/api/retrieve/${recordId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      const recordDetails = document.getElementById('recordDetails');
      const recordContent = document.getElementById('recordContent');
      recordContent.textContent = JSON.stringify(data.data, null, 2);
      recordDetails.style.display = 'block';
    })
    .catch(error => {
      console.error('Error:', error);
    });
  });
}

// Handle update record form submission
const updateRecordForm = document.getElementById('updateRecordForm');
if (updateRecordForm) {
  updateRecordForm.addEventListener('submit', function(event) {
    event.preventDefault();
    event.stopPropagation();

    const recordId = document.getElementById('recordId').value;
    const conditionSeverity = document.getElementById('conditionSeverity').value;
    const dischargeDate = document.getElementById('dischargeDate').value;
    const doctorId = document.getElementById('doctorId').value;
    const treatmentCode = document.getElementById('treatmentCode').value;

    const data = {
      conditionSeverity: parseInt(conditionSeverity),
      dischargeDate: parseInt(dischargeDate),
      doctorId: parseInt(doctorId),
      treatmentCode: parseInt(treatmentCode)
    };

    fetch(`http://localhost:3000/api/update-medical-record/${recordId}`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
      window.location.href = `verify.html?recordId=${recordId}`;
    })
    .catch(error => {
      console.error('Error:', error);
    });
  });
}

// Handle verify form submission
const verifyForm = document.getElementById('verifyForm');
if (verifyForm) {
  verifyForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const recordId = document.getElementById('verifyRecordId').value;
    
    fetch(`http://localhost:3000/api/verify/${recordId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      const resultDiv = document.getElementById('verificationResult');
      resultDiv.textContent = JSON.stringify(data, null, 2);
      resultDiv.style.display = 'block';
    })
    .catch(error => {
      console.error('Error:', error);
    });
  });
}
