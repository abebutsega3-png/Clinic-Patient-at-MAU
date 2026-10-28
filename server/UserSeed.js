import User from "./module/User.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import connectToDB from "./db/db.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const userRegister = async () => {
    try {
        // 1. ከዳታቤዝ ጋር መገናኘት (ስህተት ካለ በራሱ Error ይጥላል)
        await connectToDB();

        // 2. Admin Account Configuration
        const adminEmail = (process.env.ADMIN_EMAIL || "admin@mau.edu.et").trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
        
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            if (existingAdmin.role !== "Admin") {
                throw new Error(`The account ${adminEmail} already exists and is not an admin.`);
            }

            existingAdmin.password = hashedAdminPassword;
            await existingAdmin.save();
            console.log(`✅ Admin account password updated: ${adminEmail}`);
        } else {
            await User.create({
                name: "System Admin",
                email: adminEmail,
                password: hashedAdminPassword,
                role: "Admin",
                roles: ["Admin"],
                activeRole: "Admin",
                status: "Active"
            });
            console.log(`✅ Admin account created successfully!`);
            console.log(`📧 Email: ${adminEmail}`);
        }

        // 3. Clinic Head Account Configuration (የክሊኒክ ኃላፊ)
        const clinicHeadUsername = (process.env.CLINIC_HEAD_USERNAME || "clinichead").trim();
        const clinicHeadEmail = (process.env.CLINIC_HEAD_EMAIL || "clinichead@mau.edu.et").trim().toLowerCase();
        const clinicHeadPassword = process.env.CLINIC_HEAD_PASSWORD || "head1234";

        const existingClinicHead = await User.findOne({
            $or: [{ email: clinicHeadEmail }, { username: clinicHeadUsername }]
        });

        if (existingClinicHead) {
            console.log(`Clinic Head account already exists: Username: ${clinicHeadUsername}`);
        } else {
            await User.create({
                name: "Clinic Head",
                username: clinicHeadUsername,
                email: clinicHeadEmail,
                password: await bcrypt.hash(clinicHeadPassword, 10),
                role: "Clinic Head",
                roles: ["Clinic Head"],
                activeRole: "Clinic Head",
                status: "Active"
            });
            console.log(`✅ Clinic Head account created: Username: ${clinicHeadUsername}`);
        }

        // 4. Card Chief Account Configuration (የካርድ ክፍል ኃላፊ)
        const cardChiefUsername = (process.env.CARD_CHIEF_USERNAME || "cardchief").trim();
        const cardChiefEmail = (process.env.CARD_CHIEF_EMAIL || "cardchief@mau.edu.et").trim().toLowerCase();
        const cardChiefPassword = process.env.CARD_CHIEF_PASSWORD || "card1234";

        const existingCardChief = await User.findOne({
            $or: [{ email: cardChiefEmail }, { username: cardChiefUsername }]
        });

        if (existingCardChief) {
            console.log(`Card Chief account already exists: Username: ${cardChiefUsername}`);
        } else {
            await User.create({
                name: "Card Chief",
                username: cardChiefUsername,
                email: cardChiefEmail,
                password: await bcrypt.hash(cardChiefPassword, 10),
                role: "Card Chief",
                roles: ["Card Chief"],
                activeRole: "Card Chief",
                status: "Active"
            });
            console.log(`✅ Card Chief account created: Username: ${cardChiefUsername}`);
        }

        // 5. Success summary log
        console.log("\n==========================================");
        console.log(`Admin Email: ${adminEmail}`);
        console.log(`Clinic Head Username: ${clinicHeadUsername}`);
        console.log(`Card Chief Username: ${cardChiefUsername}`);
        console.log("==========================================\n");

    } catch (error) {
        console.error("Error seeding users:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Database disconnected successfully.");
    }
};

userRegister();