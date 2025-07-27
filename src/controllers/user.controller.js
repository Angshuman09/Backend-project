import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'
// import { upload } from '../midlewares/multer.middleware.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'

const getAccessTokenAndRefreshToken = async (userid) => {
    try {
        const user = await User.findById(userid);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken }
    } catch (err) {
        throw new ApiError(500, "something went wrong when try to generate access and refresh token");
    }
}


const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res
    // console.log(req)
    // console.log(req.body)
    // console.log(req.files)
    const { fullName, email, username, password } = req.body;

    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are requried")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) throw new ApiError(400, "avatar is not found")

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) throw new ApiError(400, "avatar is required")

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createUser) throw new ApiError(500, "Something went wrong when registering the user")

    return res.status(201).json(
        new ApiResponse(200, createUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    console.log(req);
    console.log(req.body);
    const { username, email, password } = req.body;


    if (!username && !password) throw new ApiError(400, "username or passowrd is needed");

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) throw new ApiError(400, "username or email is not found");

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) throw new ApiError(400, "password is not valid");

    const { accessToken, refreshToken } = await getAccessTokenAndRefreshToken(user._id);

    const loginUser = await User.findById(user._id).select("-password -refreshToken");

    const option = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", refreshToken, option)
        .json(
            new ApiResponse(
                200,
                { user: loginUser, accessToken, refreshToken },
                "User login successfully"
            )
        )
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logout successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) throw new ApiError(400, "unothorized token");

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        if (!decodedToken) throw new ApiError(401, "Invalid refresh token");

        const user = await User.findById(decodedToken?._id);
        if (!user) throw new ApiError(401, "invalid refresh token");

        if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "refresh token is expired or used")

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await getAccessTokenAndRefreshToken(user._id)

        return res
            .status(201)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    201,
                    { accessToken, refreshToken: newRefreshToken },
                    "access token refresh"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) throw new ApiError(400, "Invalid old password");
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(200, {}, "password change successfully");
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched successfully"));
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) throw new ApiError(400, "fullname or email is requried");

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email: email.toLowerCase()
            }
        },
        {
            new: true,
        }
    ).select("-password");

    return res.status(200)
        .json(new ApiResponse(200, user, "account details updated successfully"));
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar is not found");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) throw new ApiError(400, "avatar is required");

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password");

    return res.status(200)
        .json(new ApiResponse(200, user, "avatar updated successfully"));
})


const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) throw new ApiError(400, "cover image not found");

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage) throw new ApiError(400, "cover image is required");

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
        .json(new ApiResponse(200, user, "cover image updated successfully"));
})


const getChannelProfile = asyncHandler(async (req, res) => {
    const { username } = await req.params;

    if (!username?.trim()) throw new ApiError(400, "username is requried");

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: 'subscriptions',
                localfield: '_id',
                foreignField: 'channel',
                as: 'subscribers'
            }
        },
        {
            $lookup: {
                from: 'subscriptions',
                localField: '_id',
                foreignField: 'subscriber',
                as: 'subscribeTo'
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "subscribers"
                },
                channelSubscribedToCount: {
                    $size: "subscribeTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },

        {
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    if(!channel.length) throw new ApiError(400,"channel doesn't exist");

    return res.status(200)
    .json(new ApiResponse(200,channel[0],"User channel fetched successfully"));

})


const getWatchedHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            
        }
    ])
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getChannelProfile
}