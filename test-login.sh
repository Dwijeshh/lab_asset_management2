#!/bin/bash

echo "Testing login endpoint..."
echo ""

# Test with admin credentials
echo "Testing admin login:"
curl -X POST https://3000-ibqfmd6ujat8q4j0xj6xt.e2b.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@manipal.edu","password":"password123"}' \
  -c cookies.txt \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "---"
echo ""

# Test with wrong password
echo "Testing with wrong password:"
curl -X POST https://3000-ibqfmd6ujat8q4j0xj6xt.e2b.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@manipal.edu","password":"wrongpassword"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "---"
echo ""

# Test /api/auth/me with cookie
echo "Testing /api/auth/me with session:"
curl https://3000-ibqfmd6ujat8q4j0xj6xt.e2b.app/api/auth/me \
  -b cookies.txt \
  -w "\nHTTP Status: %{http_code}\n"
