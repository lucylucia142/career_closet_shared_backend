const axios = require('axios');
const { chai } = require('chai');
const { faker } = require('@faker-js/faker');

describe('POST API Request Tests', async () => {
  it('should be able to post  details', async () => {
    const res = await axios.post('http://localhost:3000/cart/68b76bbecf6f83c6f2c902a5', {
  
  "userId": {
    "$oid": "68cafc4e573fdfb65d90a833"
  },
  "items": {},
  "updatedAt": {
    "$date": "2025-09-17T19:58:11.917Z"
  }
});
    console.log(res.data);
   
  });
});