import mongoose from 'mongoose'
import { DB_NAME } from '../constants.js'

const connectDB = async ()=>{
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`connection is done!! ${connectionInstance.connection.host}`)
    }
    catch(err){
        console.log("db connection error is occur:",err);
        process.exit(1);
    }
}

export default connectDB