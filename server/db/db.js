import mongoose from "mongoose";

const connectToDB = async () => {
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGODB_URL;
    if (!mongoUrl) {
        throw new Error("Set MONGODB_URI or MONGODB_URL in server/.env.");
    }

    await mongoose.connect(mongoUrl, {
        serverSelectionTimeoutMS: 45000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
        family: 4
    });

    const database = mongoose.connection.db;
    if (!database) {
        throw new Error("MongoDB connected without selecting a database. Include a database name in the connection URI.");
    }

    const hasPatientsCollection = await database
        .listCollections({ name: "patients" }, { nameOnly: true })
        .hasNext();
    if (!hasPatientsCollection) {
        await database.createCollection("patients");
    }

    console.log("Connected to MongoDB successfully!");
    console.log(`Database "${database.databaseName}" is ready.`);
};

export default connectToDB;