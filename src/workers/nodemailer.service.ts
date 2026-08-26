// src/workers/nodemailer.service.ts
import nodemailer from "nodemailer";
import { ENV } from "./env_validator";

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: ENV("GMAIL_USER"),
    pass: ENV("GMAIL_APP_PASSWORD"),
  },
});