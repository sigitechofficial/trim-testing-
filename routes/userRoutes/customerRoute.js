const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const appController = require('../../controllers/userControllers/customerController');
const protect = require('../../middlewares/accessCheck');
const publicProtected = require('../../middlewares/publicProtected');
const catchAsync = require('../../middlewares/catchAync');

const destinationDirectory = './Public/Customer-Profiles/';

if (!fs.existsSync(destinationDirectory)) {
    fs.mkdirSync(destinationDirectory, { recursive: true });
}

// Multer disk storage configuration
const Profile = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, destinationDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, 'Profile-Image-' + Date.now() + path.extname(file.originalname));
    }
});

// Multer middleware setup
const ProfileImage = multer({
    storage: Profile,
});

// !Module:1 Home

router.post('/email-testing', catchAsync(appController.emailtesting));
router.get('/session', protect, catchAsync(appController.session));
router.post('/home', publicProtected, catchAsync(appController.home));
router.post('/search', publicProtected, catchAsync(appController.home));
router.get('/favorites/:favorite', protect, catchAsync(appController.home));
 
router.get('/salon-detail/:id',publicProtected, catchAsync(appController.salonDetails));
router.get('/salon-times/:salon', catchAsync(appController.salonTimes));
router.get('/employee-times/:employee', catchAsync(appController.employeeTimes));
router.get('/employee-detail/:id', catchAsync(appController.employeeDetails));
router.get('/check-session', catchAsync(appController.session));

router.post('/employees-with-services/salon/:salon', catchAsync(appController.employeesWithAllServices));
router.post('/employees-availability/employee/:employee', catchAsync(appController.employeeAvailability));
router.post('/salon-availability/salon/:salon', catchAsync(appController.salonAvailability));
router.post('/book-appointment', protect ,catchAsync(appController.bookAppointment));

router.post('/upfront-payment-info', protect ,catchAsync(appController.captureUpFrontPaymentInfo));

router.post('/solo-employee-appointment-schedule/:bookingId', protect ,catchAsync(appController.rescheduleSoloEmployeeAppointment));
router.post('/multiple-employee-appointment-schedule/:bookingId', protect ,catchAsync(appController.rescheduleMultipleEmployeeAppointment));
router.patch('/cancel-appointment/:bookingId', protect ,catchAsync(appController.cancelAppointment));

router.get('/appointments', protect ,catchAsync(appController.fecthAppointments));
router.get('/appointment-detail/:id', protect ,catchAsync(appController.fecthAppointmentsDetails));
router.get('/appointment/:status', protect ,catchAsync(appController.fecthAppointments));

// CARDS
router.post('/add-card',protect, catchAsync(appController.addCard));
router.get('/view-cards',protect, catchAsync(appController.fetchCards));
router.put('/detach-card/:pm',protect, catchAsync(appController.detachCard));

// Coupons 
router.post('/apply-coupon',protect, catchAsync(appController.applyCoupon));

// Drawer 
router.patch('/profile-update',protect, catchAsync(appController.UpdateProfileData));
router.patch('/profile-image-update', protect, ProfileImage.single('image'),catchAsync(appController.profileImageUpdate));
router.patch('/like-dislike/:salon', protect, catchAsync(appController.likeDislike));
router.get('/ratings-and-reviews', protect, catchAsync(appController.ratingAndReviews));
router.get('/ratings-and-reviews/:appointment', protect, catchAsync(appController.ratingAndReviews));
router.post('/ratings-and-reviews',protect , catchAsync(appController.rateEmployes));
router.post('/ratings-and-reviews/skip',protect , catchAsync(appController.skipRating));


//Stripe customers Ephemeral Secret

router.patch('/ephemeral-secret/renew',protect , catchAsync(appController.renewEphemeralSecret));

//!Salon policies

router.get("/salon-policies/:salon", catchAsync(appController.salonPolicies));

//!Check Subscription

router.get('/check-subscription', catchAsync(appController.checkSubscription));

//! Client Feed Back

router.get('/client-feedback/salon/:salon', catchAsync(appController.clientFeedBack));
router.get('/client-feedback/employee/:employee', catchAsync(appController.clientFeedBack));
router.get('/client-feedback/customer/:client', catchAsync(appController.clientFeedBack));
router.get('/client-feedback/appointment/:booking', catchAsync(appController.clientFeedBack));

module.exports = router;
