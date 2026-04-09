import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

async function testUpload() {
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream('package.json'));

    const response = await axios.post('http://localhost:3000/api/upload', formData, {
      headers: formData.getHeaders()
    });
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testUpload();
