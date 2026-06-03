import http from 'http';
http.get('http://localhost:3000', (res) => {
  console.log('Status Code:', res.statusCode);
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
