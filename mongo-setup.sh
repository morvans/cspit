#!/bin/bash

echo "Waiting for MongoDB to start..."
sleep 15

echo "Initializing replica set..."
mongosh --host mongo:27017 --eval '
rs.initiate({
  _id: "rs0",
  members: [
    {
      _id: 0,
      host: "mongo:27017"
    }
  ]
})
'

echo "Waiting for replica set to be ready..."
sleep 10

echo "Checking replica set status..."
mongosh --host mongo:27017 --eval 'rs.status()'

echo "MongoDB replica set initialization completed!"
