import { Router } from "express";
import express from 'express'
import { registerUser, loginUser, logoutUser } from "../controllers/user.controller.js";
import { upload } from '../midlewares/multer.middleware.js'
import { verifyJWT } from "../midlewares/auth.middleware.js";
const router = Router()

//here we are using multer middlware to upload avatar and coverImage in 
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
//     registerUsert stolen tokens
// )

router.route('/login').post(loginUser)

router.route('/logout').post(verifyJWT, logoutUser);

export default router;