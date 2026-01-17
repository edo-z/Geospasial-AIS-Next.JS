#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Baca .env.local
const envPath = path.join(__dirname, '.env.local');
let uri = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/MONGODB_URI\s*=\s*(.+)/);
  const match2 = envContent.match(/MONGODB_URI2\s*=\s*(.+)/);
  if (match) {
    uri = match[1].trim();
  }
}

console.log('MongoDB URI:', uri ? uri.substring(0, 50) + '...' : 'NOT FOUND');
console.log('MongoDB URI2:', uri ? uri.substring(0, 50) + '...' : 'NOT FOUND');

async function checkAuth() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('magang-ais');
    const user = await db.collection('user').findOne({ email: 'admin@admin.id' });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('\n User data:');
    console.log('- Email:', user.email);
    console.log('- Name:', user.name);
    console.log('- Password (first 50 chars):', user.password ? user.password.substring(0, 50) : 'NONE');
    console.log('- Password length:', user.password ? user.password.length : 0);
    
    // Test berbagai password
    const passwordsToTest = ['admin123', 'admin', 'password', 'admin@admin.id', '12345678', '123456'];
    
    console.log('\n🔐 Testing common passwords:');
    for (const testPass of passwordsToTest) {
      try {
        const isMatch = await bcrypt.compare(testPass, user.password);
        console.log(`- '${testPass}' => ${isMatch ? '✅ MATCH' : '❌'}`);
      } catch (e) {
        console.log(`- '${testPass}' => ERROR: ${e.message}`);
      }
    }
    
    // Check if password looks like bcrypt hash
    if (user.password && user.password.startsWith('$2')) {
      console.log('- ✅ Password looks like a bcrypt hash (starts with $2)');
    } else {
      console.log('- ❌ Password does NOT look like a bcrypt hash');
      console.log('  (Might be plain text or different hashing algorithm)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkAuth();
