import { Router } from "express";
import express from 'express'
import { registerUser } from "../controllers/user.controller.js";
import { upload } from '../midlewares/multer.middleware.js'

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )

// const router = express.Router()
// router.post('/register',
//     upload.fields([
//         {
//             name: 'avatar',
//             maxCount: 1
//         }, {
//             name: 'coverImage',
//             maxCount: 1
//         }
//     ]),
//     registerUser
// )

export default router;