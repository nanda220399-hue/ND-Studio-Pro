import axios from 'axios';

async function testCors() {
  try {
    const response = await axios.options('https://tmpfiles.org/api/v1/upload', {
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    });
    console.log('CORS Headers:', response.headers);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testCors();
