const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000

const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(403).send({ error: true, message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.cm8vu8j.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

async function run() {
    try {
        const usersCollection = client.db('culinaryDB').collection('users')
        const classedCollection = client.db('culinaryDB').collection('classes')
        const cartsCollection = client.db('culinaryDB').collection('carts')

        const verifyRole = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin' && user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token });
        })

        app.get('/users', verifyJWT, verifyRole, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        app.get('/instructor', async (req, res) => {
            const query = { role: 'instructor' }
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        app.put('/users/:email', async (req, res) => {
            const user = req.body;
            const email = req.params.email;
            const query = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(query, updateDoc, options)
            // console.log(result);
            res.send(result)
        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/class', verifyJWT, verifyRole, async (req, res) => {
            const newClass = req.body;
            const result = await classedCollection.insertOne(newClass)
            res.send(result);
        })

        app.get('/class/:email', verifyJWT, verifyRole, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Forbidden Access" })
            }
            const query = { 'instructor.email': email }
            const result = await classedCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/class', async (req, res) => {
            const result = await classedCollection.find().toArray();
            res.send(result);
        })


        // app.put('/class/:id', async (req, res) => {
        //     const classes = req.body
        //     console.log(req.body);
        //     const id = req.params.id;
        //     const filter = { _id: id }
        //     console.log(filter);
        //     const options = { upsert: true }
        //     const updateDoc = {
        //         $set: classes,
        //     }
        //     const result = await classedCollection.updateOne(filter, updateDoc, options)
        //     res.send(result)
        // })

        app.get('/approve', async (req, res) => {
            const result = await classedCollection.find().toArray();
            res.send(result);
        })

        app.patch('/class/approved/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'approve'
                }
            };
            const result = await classedCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/class/deny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'deny'
                }
            };
            const result = await classedCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/class/feedback', async (req, res) => {
            const { classId, feedback } = req.body;
            const filter = { _id: new ObjectId(classId) };
            const updateDoc = {
                $set: {
                    feedback: feedback,
                },
            };
            const result = await classedCollection.updateOne(filter, updateDoc);
            res.send(result)
        });

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartsCollection.insertOne(item)
            res.send(result);
        })

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartsCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query);
            res.send(result);
        })

        // app.post('/create-payment-intent', verifyJWT, async(req, res) => {
        //     const {price} = req.body;
        //     const amount = price*100;
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: 'usd',
        //         payment_method_types: ['card']
        //     });
        //     res.send({
        //         clientSecret: paymentIntent.client_secret
        //     })
        // })



        // Send a ping to confirm a successful connection
        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('culinary Server is running...')
})

app.listen(port, () => {
    console.log(`culinary is running on port ${port}`)
})