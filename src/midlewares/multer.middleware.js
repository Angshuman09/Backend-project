import multer from "multer"

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log("multer destination triggered")
    cb(null, "./public/temp")
  },
  filename: function (req, file, cb) {
    console.log("multer filename triggered")
    cb(null, file.originalname)
  }
})

export const upload = multer({ storage })