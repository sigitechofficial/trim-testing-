const { Op, literal, col, fn, where } = require("sequelize");
const {
  salonDetail,
  addressDBS,
  coupon,
  employee,
  time,
  category,
  service,
  booking,
  user,
  jobs,
  cancelledBooking,
  reason,
  employeeService,
  rating,
  wallet,
} = require("../../models");
const Stripe = require("../stripe");
const appError = require("../../utils/appError");
const Slot = require("../../utils/timeSlots");
const dateManipulation = require("../../utils/dateManipulation");
const Custom = require("../../utils/customFunctions");
const Convert = require("../../utils/dateManipulation");

//! Return Function
let returnFunction = (status, message, data, error) => {
  return {
    status: `${status}`,
    message: `${message}`,
    data: data,
    error: `${error}`,
  };
};

//! bookings
/*
            4.Home
    ________________________________________
*/
exports.salonBookings = async (req, res, next) => {
  const userId = req.user.id;
  let bookings = [];
  // Get current date using Date object
  const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const bookingList = await booking.findAll({
    where: {
      status: {
        [Op.or]: ["book", "pending"],
      },
      clientRemoved: false,
      on: {
        [Op.gte]: currentDate, // Filter bookings where 'on' date is greater than or equal to current date
      },
    },
    include: [
      {
        model: user,
      },
      {
        model: jobs,
        include: [
          { model: service },
          { model: employee, include: { model: user } },
        ],
      },
      {
        model: salonDetail,
        required: true,
        where: {
          userId,
        },
      },
    ],
  });

  const salonEmployee = await employee.findAll({
    include: [
      {
        model: salonDetail,
        where: {
          userId,
        },
        attributes: [],
      },
      {
        model: user,
        attributes: ["firstName", "lastName", "image"],
      },
    ],
    attributes: {
      exclude: ["description", "coverImage", "createdAt", "updatedAt"],
    },
  });
  let statTime, endTime;
  // return res.json(bookingList)
  let assigned = true;
  bookingList.map((booking, idx) => {
    let services = [];
    let specialists = new Set();
    booking.jobs.map((ele) => {
      if (ele.employeeId === null) {
        assigned = false;
      }
      if (ele.employee && ele.employee.user) {
        specialists.add(ele.employee.user.firstName); // Add specialist name to the set
      }
      services.push(ele.service?.serviceName);
    });

    // Convert Set to array
    specialists = [...specialists];

    statTime = dateManipulation.convertTo12HourFormat(booking.startTime);
    endTime = dateManipulation.convertTo12HourFormat(booking.endTime);
    let retObj = {
      id: booking.id,
      statTime,
      endTime,
      scheduleDate: booking.on,
      assigned,
      client: `${booking.user?.firstName} ${booking.user?.lastName}`,
      total: booking.total,
      services,
      specialists: assigned ? specialists : ["Anyone"],
    };
    bookings.push(retObj);
  });

  return res.json(
    returnFunction("1", "Salon All Bookings", { salonEmployee, bookings }, "")
  );
};
/*
            4.Filtered Bookings
    ________________________________________
*/
exports.getbookingByFilter = async (req, res, next) => {
  const userId = req.user.id;
  let { employeeId, serviceId, orderStatus } = req.body;
  // let price = req.query.price;
  let filteredBooking = [];
  const bookingList = await booking.findAll({
    where: {
      status: {
        [Op.or]: ["book", "pending"],
      },
      clientRemoved: false,
    },
    include: [
      {
        model: user,
      },
      {
        model: jobs,
        include: { model: service },
      },
      {
        model: salonDetail,
        where: {
          userId,
        },
      },
    ],
  });
  let statTime, endTime;
  bookingList.map((booking, idx) => {
    if (serviceId) {
      let found = booking.jobs.find(
        (ele) => ele.service.id === parseInt(serviceId)
      );
      if (!found) return null;
    }

    if (employeeId) {
      let found = booking.jobs.find(
        (ele) => ele.employeeId === parseInt(employeeId)
      );
      if (!found) return null;
    }

    if (orderStatus) {
      let found = booking.jobs.find((ele) => ele.status === orderStatus);
      if (!found) return null;
    }
    let assigned = true;
    let services = [];
    let specialists = [];
    booking.jobs.map((ele) => {
      if (ele.employeeId === null) {
        assigned = false;
      }
      specialists.push(ele.employee?.user.firstName);
      services.push(ele.service.serviceName);
    });
    statTime = dateManipulation.convertTo12HourFormat(booking.startTime);
    endTime = dateManipulation.convertTo12HourFormat(booking.endTime);
    let retObj = {
      id: booking.id,
      statTime,
      endTime,
      scheduleDate: booking.on,
      assigned,
      client: `${booking.user.firstName} ${booking.user.lastName}`,
      total: booking.total,
      services,
      specialists: assigned ? specialists : ["Anyone"],
    };
    filteredBooking.push(retObj);
  });

  const response = returnFunction(
    "1",
    "List of Bookings",
    { filteredBooking },
    ""
  );
  return res.json(response);
};
/*
              4.Booking Details
      ________________________________________
  */
exports.bookingDetails = async (req, res, next) => {
  const { bookingId } = req.body;
  let bookings = [];
  const bookingData = await booking.findByPk(bookingId, {
    include: [
      {
        model: user,
        attributes: [
          "id",
          "firstName",
          "lastName",
          "countryCode",
          "phoneNum",
          "image",
          "email",
        ],
      },
      {
        model: jobs,
        include: [
          { model: service, attributes: ["serviceName", "price"] },
          {
            model: employee,
            include: {
              model: user,
              attributes: ["id", "firstName", "lastName"],
            },
            attributes: ["id", "position"],
          },
        ],
      },
    ],
  });
  let cardDetails;
  if (bookingData.paymentMethod == "card") {
    cardDetails = await Stripe.retrievePaymentMethod(bookingData.stripeCardId);
  }
  let services = [];
  let startTime, endTime;
  bookingData.jobs.map((ele) => {
    let obj = {
      id: ele.id,
      status: ele.status,
      serviceId: ele.serviceId,
      serviceName: ele.service.serviceName,
      price: ele.service.price,
      startTime:dateManipulation.convertTo12HourFormat(ele.startTime),
      duration: ele.duration,
      endTime:dateManipulation.convertTo12HourFormat(ele.endTime),
      employeeId:ele.employeeId,
      specialists: ele.employee ? `${ele.employee.user.firstName}` : "AnyOne",
      extra: ele.Extra,
    };
    services.push(obj);
  });

  let bookingDetail = {
    id: bookingData.id,
    scheduleDate: bookingData.on,
    client: `${bookingData.user?.firstName ?? ""} ${
      bookingData.user?.lastName ?? ""
    }`,
    profile: bookingData.user?.image ?? "",
    email: bookingData.user?.email ?? "",
    Phone: `${bookingData.user?.countryCode ?? ""}${
      bookingData.user?.phoneNum ?? ""
    }`,
    salonDetailId: bookingData.salonDetailId,
    Upfront: bookingData.initialPayment,
    duration: bookingData.duration,
    initialPayment: bookingData.initialPayment,
    total: bookingData.total,
    customerId: bookingData?.customerId ?? "",
    last4: cardDetails?.last4 ?? "",
    paymentMethodId: bookingData?.stripeCardId ?? "",
    services,
  };
  return res.json(
    returnFunction("1", "Booking Details", { bookingDetail }, "")
  );
};
/*
              4.Cancel Reasons
      ________________________________________
  */
exports.reasons = async (req, res, next) => {
  const reasons = await reason.findAll({
    attributes: ["id", "reason"],
  });
  return res.json(
    returnFunction("1", "Booking Cancelled Reasons", { reasons }, "")
  );
};
/*
              4.Cancel Booking
      ________________________________________
  */
exports.cancelBooking = async (req, res, next) => {
  const userId = req.user.id;
  const { bookingId, reasonId, reasonText } = req.body;
  await booking.update(
    {
      status: "cancel",
    },
    {
      where: { id: bookingId },
    }
  );
  const Reason = await reason.findByPk(reasonId, {
    attributes: ["id", "reason"],
  });
  // creating canceled booking details column
  const cancelBooking = await cancelledBooking.create({
    reasonText: reasonText ?? Reason.reason,
    bookingId,
    userId,
    reasonId,
  });
  return res.json(
    returnFunction("1", "Booking Cancelled Successfully!", {}, "")
  );
};
/*
              4.Get Services of salon
      ________________________________________
  */
exports.getServices = async (req, res, next) => {
  const userId = req.user.id;
  const formattedServices = await category.findAll({
    include: [
      {
        model: service,
        include: {
          model: category,
          attributes: ["categoryName", "color"],
        },
        attributes: {
          exclude: ["description", "createdAt", "updatedAt"],
        },
      },
      {
        model: salonDetail,
        where: {
          userId,
        },
      },
    ],
    attributes: {
      exclude: ["description", "createdAt", "updatedAt"],
    },
  });
  const allServices = formattedServices.map((category) => {
    const services = category.services.map((service) => {
      const {
        category: { categoryName, color },
        ...rest
      } = service.toJSON();
      return {
        ...rest,
        categoryName,
        color,
      };
    });

    return {
      ...category.toJSON(),
      services,
    };
  });
  return res.json(returnFunction("1", "Salon Services", { allServices }, ""));
};
/*
              4.Get Services of Ctegories
      ________________________________________
  */
exports.getServicesofCategories = async (req, res, next) => {
  const userId = req.user.id;
  const { categoryId } = req.body;
  const Services = await service.findAll({
    where: { categoryId },
    include: {
      model: salonDetail,
      where: {
        userId,
      },
      attributes: [],
    },
  });
  return res.json(returnFunction("1", "Salon Services", { Services }, ""));
};
/*
              4.Find Employees That provides all selected services
      ________________________________________
  */
exports.employeesWithAllServices = async (req, res, next) => {
  const userId = req.user.id;
  const SalonDetail = await salonDetail.findOne({
    where: { userId },
  });
  const { services } = req.body;
  const employeesWithServices = await employeeService.findAll({
    where: {
      salonDetailId: SalonDetail.id,
      serviceId: {
        [Op.in]: services,
      },
    },
    attributes: ["employeeId"],
    group: ["employeeId"],
    having: literal(`COUNT(DISTINCT serviceId) = ${services.length}`),
  });
  const employeeIds =
    employeesWithServices.length > 0
      ? employeesWithServices.map(
          (employeeService) => employeeService.employeeId
        )
      : null;
  console.log("🚀~employees:", employeesWithServices);
  console.log(employeeIds);
  if (!employeeIds) {
    return res.status(200).json({
      status: "2",
      message: "No employee available move forword",
      data: {},
      error: "",
    });
  }

  const workers = await user.findAll({
    attributes: ["firstName", "lastName", "image"],
    include: [
      {
        model: employee,
        where: {
          id: {
            [Op.in]: employeeIds,
          },
        },
        attributes: [
          "id",
          "position",
          [
            literal(
              "(SELECT FORMAT(AVG(ratings.value), 1) FROM ratings WHERE ratings.employeeId = employees.id)"
            ),
            "employeeAverageRating",
          ],
          [
            literal(
              "(SELECT COUNT(ratings.id) FROM ratings WHERE ratings.employeeId = employees.id)"
            ),
            "totalRatings",
          ],
        ],
        include: [
          {
            model: time,
            attributes: ["openingTime", "closingTime", "day"],
          },
          {
            model: rating,
            attributes: [],
          },
        ],
      },
    ],
  });

  const result = workers.map((ele) => {
    const obj = ele.toJSON();
    obj.employee = obj.employees[0];
    delete obj.employees;
    return obj;
  });
  return res.json(
    returnFunction("1", "Salon Employee's", { employees: result }, "")
  );
};
/*
              4.Check Employees availability
      ________________________________________
  */
exports.employeeAvailability = async (req, res, next) => {
  const { jobDate, duration, employeeId } = req.body;
  var date = new Date(jobDate);
  let daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  let dayOfWeekIndex = date.getDay();
  const dateDay = daysOfWeek[dayOfWeekIndex];
  console.log(employeeId);
  const employeeTiming = await time.findOne({
    where: {
      employeeId,
      day: dateDay,
    },
  });
  if (!employeeTiming) {
    return res.json(
      returnFunction(
        "1",
        "Time Slots not Available",
        { availableTimeSlots: [] },
        ""
      )
    );
  }
  const busyTimes = await jobs.findAll({
    where: { status: "assign", employeeId },
    attributes: ["startTime", "endTime"],
  });

  const availableTimeSlots = Slot.getAvailableTimeSlots(
    jobDate,
    employeeTiming.openingTime,
    employeeTiming.closingTime,
    duration,
    busyTimes
  );

  return res.json(
    returnFunction("1", "Available Time Slots", { availableTimeSlots }, "")
  );
};
/*
              4.Add Extra Service in Booking 
      ________________________________________
  */
exports.addExtraService = async (req, res, next) => {
  const { extraServices } = req.body;
  let startTime, endTime;
  extraServices.map(async (ele) => {
    startTime = dateManipulation.convertTo24HourFormat(ele.startTime);
    endTime = dateManipulation.convertTo24HourFormat(ele.endTime);

    await jobs.create({
      bookingId: ele.bookingId,
      serviceId: ele.serviceId,
      employeeId: ele.employeeId,
      on: ele.jobDate,
      startTime,
      endTime,
      total: ele.total,
      duration: ele.duration,
      Extra: true,
    });
  });

  return res.json(
    returnFunction("1", "Extra Service Added Successfully!", {}, "")
  );
};
/*
           schedule jobs
     _____________________________
*/
function scheduleJobs(startTime, jobs, jobDate, bookingId, employeeId) {
  const [startHour, startMinute, ampm] = startTime.split(/:|\s/);
  let currentTime = parseInt(startHour) * 60 + parseInt(startMinute);
  if (ampm.toLowerCase() === "pm") {
    currentTime += 12 * 60;
  }

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60) % 12 || 12;
    const mins = minutes % 60;
    const period = minutes < 720 ? "am" : "pm";
    return `${padZero(hours)}:${padZero(mins)} ${period}`;
  };

  const padZero = (num) => (num < 10 ? `0${num}` : num);

  const jobSchedule = [];

  for (const job of jobs) {
    const duration = job.duration;
    const scheduledJob = {
      ...job,
      startTime: formatTime(currentTime),
      endTime: formatTime(currentTime + duration),
      on: jobDate,
      bookingId,
      status: "assign",
      employeeId,
    };
    jobSchedule.push(scheduledJob);
    currentTime += duration;
  }

  return jobSchedule;
}
/*
              4.Get All Customers of Salon
      ________________________________________
  */
exports.getSalonCustomer = async (req, res, next) => {
  const userId = req.user.id;
  const SalonDetail = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  const salonCustomers = await booking.findAll({
    where: {
      salonDetailId: SalonDetail.id,
    },
    include: [
      {
        model: user,
        attributes: [
          `id`,
          `firstName`,
          "lastName",
          "email",
          "countryCode",
          "phoneNum",
          "image",
        ],
      },
    ],
    attributes: ["customerId"],
    group: ["customerId"], // Group by customerId to ensure uniqueness
  });

  return res.json(
    returnFunction("1", "Customer Added Successfully!", { salonCustomers }, "")
  );
};
/*
              4.Add Walkn in Customer by barber 
      ________________________________________
  */
exports.addWalkinCustomer = async (req, res, next) => {
  const userId = req.user.id;
  const { email, countryCode, phoneNum, firstName, lastName } = req.body;
  const SalonDetail = await salonDetail.findOne({
    where: {
      userId,
    },
  });

  let userExist = await user.findOne({
    where: {
      [Op.or]: [
        { email: email },
        { [Op.and]: [{ countryCode: countryCode }, { phonenum: phoneNum }] },
      ],
      deletedAt: { [Op.is]: null },
    },
  });
  if (userExist && [2, 3, 4].includes(userExist.userTypeId)) {
    return next(new appError("A Barber with the follwoing email exists ", 200));
  }

  if (userExist) {
    if (email === userExist.email || phoneNum === userExist.phoneNum) {
      return res.json(
        returnFunction("1", "Customer Already Exist!", { User: userExist }, "")
      );
    }
  }
  const User = await user.create({
    email,
    countryCode,
    phoneNum,
    signedFrom: "walkin",
    firstName,
    lastName,
    userTypeId: 1,
  });

  return res.json(
    returnFunction("1", "Customer Added Successfully!", { User }, "")
  );
};
/*
              4.Add Walkn in Booking by barber 
      ________________________________________
  */
exports.addWalkinBooking = async (req, res, next) => {
  const userId = req.user.id;
  let {
    startTime,
    endTime,
    jobDate,
    jobsData,
    duration,
    customerId,
    employeeId,
  } = req.body;
  const SalonDetail = await salonDetail.findOne({
    where: {
      userId,
    },
  });
  startTime = Convert.convertTo24HourFormat(startTime);
  endTime = Convert.convertTo24HourFormat(endTime);
  const AddBooking = await booking.create({
    startTime,
    endTime,
    salonDetailId: SalonDetail.id,
    on: jobDate,
    customerId: customerId ?? null,
    duration,
    total: jobsData[0].total - jobsData[0].discount,
    paymentMethod: "cash",
  });

  await jobs.create({
    startTime,
    endTime,
    on: jobDate,
    bookingId: AddBooking.id,
    serviceId: jobsData[0].serviceId,
    duration: jobsData[0].duration,
    total: jobsData[0].total,
    discount: jobsData[0].discount,
    employeeId,
  });
  return res.json(
    returnFunction(
      "1",
      "Walkin Booking Added Successfully!",
      { bookingId: AddBooking.id },
      ""
    )
  );
};
/*
              4.Update Job Status
      ________________________________________
  */
exports.jobStatus = async (req, res, next) => {
  const { status, jobIds, notify } = req.body;
  await jobs.update(
    {
      status,
    },
    {
      where: { id: jobIds },
    }
  );
  return res.json(
    returnFunction("1", "Job Status Updated Successfully!", {}, "")
  );
};
/*
              4.Client Booking History
      ________________________________________
  */
exports.clientHistory = async (req, res, next) => {
  const userId = req.user.id;
  const { customerId } = req.body;
  const clientBookings = await booking.findAll({
    where: {
      customerId,
    },
    include: [
      {
        model: salonDetail,
        where: {
          userId,
        },
        attributes: [],
      },
      {
        model: jobs,
        include: [
          {
            model: service,
            attributes: ["serviceName"],
          },
          {
            model: employee,
            required: false,
            include: {
              model: user,
              attributes: ["firstName", "lastName"],
            },
            attributes: [["id", "employeeId"]],
          },
        ],
        attributes: ["id", "total", "duration"],
      },
    ],
    attributes: ["id", "status", "on", "startTime"],
  });
  return res.json(
    returnFunction("1", "Client Booking History", { clientBookings }, "")
  );
};
/*
              4.CheckOut Api
      ________________________________________
  */
exports.checkOutBooking = async (req, res, next) => {
  const userId = req.user.id;
  const { bookingId } = req.body;
  let bookingData = await booking.findByPk(bookingId, {
    include: [
      {
        model: salonDetail,
      },
      {
        model: jobs,
        include: [
          {
            model: service,
            attributes: ["serviceName"],
          },
          {
            model: employee,
            required: false,
            include: {
              model: user,
              attributes: ["firstName", "lastName"],
            },
            attributes: [["id", "employeeId"]],
          },
        ],
        attributes: ["id", "total", "duration"],
      },
      {
        model: user,
        attributes: ["stripeCustomerId"],
      },
    ],
    attributes: [
      "id",
      "status",
      "on",
      "startTime",
      "initialPayment",
      "discount",
      "total",
      "tip",
      "stripeCardId",
    ],
  });
  // return res.json(bookingData)
  const accountId = bookingData.salonDetail.connectAccountId;
  const customerId = bookingData.user.stripeCustomerId;
  const actualCapturedAmount =
    parseFloat(bookingData.total) +
    parseFloat(bookingData.tip) -
    parseFloat(bookingData.discount);
  const amount =
    parseFloat(bookingData.total) +
    parseFloat(bookingData.tip) -
    parseFloat(bookingData.discount) -
    parseFloat(bookingData.initialPayment);
  const payments = await Stripe.capturePayment(
    amount,
    customerId,
    bookingData.stripeCardId,
    accountId
  );

  if (payments.status === "succeeded") {
    let salonWallet = await wallet.findOne({
      where: {
        salonDetailId: bookingData.salonDetail.id,
      },
    });
    salonWallet.amount = actualCapturedAmount;
    await salonWallet.save();

    bookingData.status = "complete";
    bookingData.actualCapturedAmount = actualCapturedAmount;
    bookingData.finalPayment = "paid";
    await bookingData.save();
    return res.json(returnFunction("1", "Payment Successfully Done", {}, ""));
  } else {
    // Payment failed or was not successful
    return res.json(returnFunction("0", "Payment capture failed", {}, ""));
  }
};
/*
              4.CheckOut Cash Api
      ________________________________________
  */
exports.checkoutCash = async (req, res, next) => {
  const userId = req.user.id;
  const { bookingId } = req.body;
  let bookingData = await booking.findByPk(bookingId, {
    include: [
      {
        model: salonDetail,
      },
      {
        model: jobs,
        include: [
          {
            model: service,
            attributes: ["serviceName"],
          },
          {
            model: employee,
            required: false,
            include: {
              model: user,
              attributes: ["firstName", "lastName"],
            },
            attributes: [["id", "employeeId"]],
          },
        ],
        attributes: ["id", "total", "duration"],
      },
      {
        model: user,
        attributes: ["stripeCustomerId"],
      },
    ],
    attributes: [
      "id",
      "status",
      "on",
      "startTime",
      "initialPayment",
      "discount",
      "total",
      "tip",
      "stripeCardId",
    ],
  });
  // return res.json(bookingData)
  const actualCapturedAmount =
    parseFloat(bookingData.total) +
    parseFloat(bookingData.tip) -
    parseFloat(bookingData.discount);
  const amount =
    parseFloat(bookingData.total) +
    parseFloat(bookingData.tip) -
    parseFloat(bookingData.discount) -
    parseFloat(bookingData.initialPayment);

  let salonWallet = await wallet.findOne({
    where: {
      salonDetailId: bookingData.salonDetail.id,
    },
  });
  salonWallet.amount = parseFloat(salonWallet.amount) + actualCapturedAmount;
  await salonWallet.save();
  bookingData.status = "complete";
  bookingData.actualCapturedAmount = actualCapturedAmount;
  bookingData.paymentMethod = "cash";
  bookingData.finalPayment = "paid";
  await bookingData.save();
  return res.json(
    returnFunction("1", "Cash Payment Successfully Done", {}, "")
  );
};
/*
              4.Save Unpaid
      ________________________________________
  */
exports.saveUnpaid = async (req, res, next) => {
  const userId = req.user.id;
  const { bookingId } = req.body;
  let bookingData = await booking.findByPk(bookingId, {
    include: [
      {
        model: salonDetail,
      },
      {
        model: jobs,
        include: [
          {
            model: service,
            attributes: ["serviceName"],
          },
          {
            model: employee,
            required: false,
            include: {
              model: user,
              attributes: ["firstName", "lastName"],
            },
            attributes: [["id", "employeeId"]],
          },
        ],
        attributes: ["id", "total", "duration"],
      },
      {
        model: user,
        attributes: ["stripeCustomerId"],
      },
    ],
    attributes: [
      "id",
      "status",
      "on",
      "startTime",
      "initialPayment",
      "discount",
      "total",
      "tip",
      "stripeCardId",
    ],
  });

  bookingData.status = "save-unpaid";
  await bookingData.save();
  return res.json(returnFunction("1", "Booking Saved UnPaid", {}, ""));
};
/*
              4.Remove Client
      ________________________________________
  */
exports.removeClient = async (req, res, next) => {
  const userId = req.user.id;
  const { customerId } = req.body;
  const clientBookings = await booking.update(
    {
      clientRemoved: true,
    },
    {
      where: {
        customerId,
      },
    }
  );
  return res.json(returnFunction("1", "Client Removed Successfully!", {}, ""));
};
//* 4.Reschedule Solo Employee Appointment -----------------

exports.rescheduleSoloEmployeeAppointment = async (req, res, next) => {
  const { bookingId, appointment, services, employeeId } = req.body;
  appointment.startTime = dateManipulation.convertTo24HourFormat(
    appointment.startTime
  );
  console.log("🚀 ~ AFTER START-TIME", appointment.startTime);

  appointment.endTime = dateManipulation.convertTo24HourFormat(
    appointment.endTime
  );
  const appointmentDate = new Date(appointment.on);
  const appointmentDay = dateManipulation.dayOnDate(appointmentDate);

  // services offered by single employees
  if (employeeId) {
    const availability = await jobs.findOne({
      where: {
        status: "assign",
        employeeId: req.body.employeeId,
        on: appointment.on,
        bookingId: { [Op.not]: bookingId },
        [Op.or]: [
          {
            // Case starts within the busy time range
            startTime: {
              [Op.between]: [appointment.startTime, appointment.endTime],
            },
          },
          {
            //  when ends within the busy time range
            endTime: {
              [Op.between]: [appointment.startTime, appointment.endTime],
            },
          },
          {
            //when within the job time range
            [Op.and]: [
              { startTime: { [Op.lte]: appointment.startTime } },
              { endTime: { [Op.gte]: appointment.endTime } },
            ],
          },
        ],
      },
      attributes: ["startTime", "endTime"],
    });

    if (availability) {
      return res.status(200).json(
        response({
          status: "2",
          message: "Time slot booked by another customer",
        })
      );
    }
  }
  const jobIds = services.map((obj) => obj.id);
  const assignTimeSlots = Custom.scheduleSessions(appointment, services);

  let sessions = await jobs.findAll({ where: { id: jobIds } });

  // Update each job's times
  assignTimeSlots.forEach((newJobData) => {
    // Find the corresponding job in sessions array by ID
    const jobToUpdate = sessions.find((job) => job.id === newJobData.id);
    if (jobToUpdate) {
      // Update startTime, endTime, and on attributes
      jobToUpdate.startTime = dateManipulation.convertTo24HourFormat(
        newJobData.startTime
      );
      jobToUpdate.endTime = dateManipulation.convertTo24HourFormat(
        newJobData.endTime
      );
      jobToUpdate.on = newJobData.on;
    } else {
      console.log(`Job with ID ${newJobData.id} not found in sessions array.`);
    }
  });
  // Save all changes to the database
  await Promise.all(sessions.map((job) => job.save()));
  await booking.update(
    {
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      on: appointment.on,
    },
    { where: { id: bookingId } }
  );
  return res.json(
    returnFunction("1", "Appointment Reschedule Successfully!", {}, "")
  );
};

//* 5.Reschedule Multiple Employee Appointment -----------------

exports.rescheduleMultipleEmployeeAppointment = async (req, res, next) => {
  const { appointment, services, bookingId } = req.body;
  appointment.startTime = dateManipulation.convertTo24HourFormat(
    appointment.startTime
  );

  appointment.endTime = dateManipulation.convertTo24HourFormat(
    appointment.endTime
  );
  const appointmentDate = new Date(appointment.on);
  const appointmentDay = dateManipulation.dayOnDate(appointmentDate);

  let employeeData, JobsInput;
  // services offered by multiple employees
  if (!req.body.employeeId) {
    employeeData = await employee.findAll({
      where: {
        salonDetailId: appointment.salonDetailId,
      },
      attributes: ["id"],
      include: [
        {
          model: employeeService,
          attributes: ["status"],
          include: {
            model: service,
            attributes: ["id"],
          },
        },
        {
          model: time,
          required: true,
          where: { day: appointmentDay },
          attributes: ["openingTime", "closingTime"],
        },
        {
          model: jobs,
          where: { on: appointment.on, status: "assign" },
          required: false,
          attributes: ["duration", "startTime", "endTime"],
        },
      ],
    });
    employeeData.sort((a, b) => a.jobs.length - b.jobs.length);
  }

  console.log("🚀~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀 ~🚀  services:", services);
  const assignTimeSlots = Custom.scheduleSessions(appointment, services);
  console.log("🚀 ~ assignTimeSlots:", assignTimeSlots);

  JobsInput = Custom.assignEmployeesToServices(employeeData, assignTimeSlots);
  appointment.status = "book";
  const findUnAssign = JobsInput.find((el) => el.status === "pending");
  if (findUnAssign) {
    appointment.status = "pending";
  }
  const jobIds = services.map((obj) => obj.id);
  console.log(
    "🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ jobIds:",
    jobIds
  );
  let sessions = await jobs.findAll({ where: { id: jobIds } });

  // Update each job's times
  JobsInput.forEach((newJobData) => {
    // Find the corresponding job in sessions array by ID
    // console.log("🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ newJobData:", newJobData)

    const jobToUpdate = sessions.find((job) => job.id === newJobData.id);
    // console.log("🚀 ~ exports.rescheduleMultipleEmployeeAppointment= ~ jobToUpdate:", jobToUpdate)
    if (jobToUpdate) {
      // Update startTime, endTime, and on attributes
      jobToUpdate.startTime = dateManipulation.convertTo24HourFormat(
        newJobData.startTime
      );
      jobToUpdate.endTime = dateManipulation.convertTo24HourFormat(
        newJobData.endTime
      );
      jobToUpdate.on = newJobData.on;
      jobToUpdate.employeeId = newJobData.employeeId;
      jobToUpdate.status = newJobData.status;
    } else {
      console.log(`Job with ID ${newJobData.id} not found in sessions array.`);
    }
  });
  // Save all changes to the database
  await Promise.all(sessions.map((job) => job.save()));
  await booking.update(
    {
      startTime: dateManipulation.convertTo24HourFormat(appointment.startTime),
      endTime: dateManipulation.convertTo24HourFormat(appointment.endTime),
      on: appointment.on,
      status: appointment.status,
    },
    { where: { id: bookingId } }
  );
  return res.json(
    returnFunction("1", "Appointment Reschedule Successfully!", {}, "")
  );
};

//* 3.salon Availability
exports.salonAvailability = async (req, res, next) => {
  const { jobDate, duration, salonDetailId } = req.body;
  const parsedDate = new Date(jobDate);
  // Get the current day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayOfWeek = parsedDate.getDay();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  // Get the name of the current day of the week
  const currentDayName = dayNames[currentDayOfWeek];
  console.log(currentDayName);
  const data = await time.findOne({
    where: { salonDetailId: salonDetailId, day: currentDayName },
    attributes: ["day", "openingTime", "closingTime"],
  });
  const salon = await salonDetail.findOne({
    where: { id: salonDetailId },
    attributes: ["id"],
  });
  if (!salon) return next(new appError("resource not Found", 200));

  const availableTimeSlots = Slot.getAvailableTimeSlots(
    jobDate,
    data.openingTime,
    data.closingTime,
    duration,
    []
  );
  return res.json(
    returnFunction("1", "Available TimeSlots", { availableTimeSlots }, "")
  );
};
/*
              4.Get Job Data
      ________________________________________
*/
exports.salonServices = async (req, res, next) => {
  const userId = req.user.id;
  const salonServices = await service.findAll({
    include: [
      {
        model: salonDetail,
        where: { userId },
        attributes: [],
      },
    ],
    attributes: ["id", "serviceName"],
  });
  return res.json(
    returnFunction("1", "All Services of Salon", { salonServices }, "")
  );
};
/*
              4.Get Job Data
      ________________________________________
*/
exports.serviceData = async (req, res, next) => {
  const userId = req.user.id;
  const { serviceId } = req.body;
  const serviceData = await service.findByPk(serviceId,{
    attributes:{
      exclude:["description","createdAt","updatedAt","createdAt","salonDetailId","serviceTypeId"]
    }
  });
  const employees = await employee.findAll({
    include: [
      {
        model: salonDetail,
        where: { userId },
        attributes: [],
      },
      {
        model: user,
        attributes: ["firstName", "lastName"],
      },
      {
        model: employeeService,
        attributes: ["serviceId"],
      },
    ],
    attributes: ["id"],
  });

  const teamMembers = employees.map((employee) => {
    const hasMatchingService = employee.employeeServices.some((service) => {
      return service.serviceId == serviceId;
    });

    return {
      employeeId: employee.id,
      name: `${employee.user.firstName} ${employee.user.lastName}`,
      provider: hasMatchingService,
    };
  });

  return res.json(
    returnFunction("1", "Service Data!", { serviceData, teamMembers }, "")
  );
};
/*
              4.Edit Service
      ________________________________________
*/
exports.editService = async (req, res, next) => {
  const userId = req.user.id;
  let { jobId, price, discount, employeeId, serviceId, startTime, duration } =
    req.body;

  startTime = dateManipulation.convertTo24HourFormat(startTime);
  let startTimeParts = startTime.split(":");
  let startHour = parseInt(startTimeParts[0]);
  let startMinute = parseInt(startTimeParts[1]);
  // Calculating the end time
  let setendTime = new Date();
  setendTime.setHours(startHour);
  setendTime.setMinutes(startMinute + duration);
  // Formatting the end time as HH:MM
  let endTime =
    ("0" + setendTime.getHours()).slice(-2) +
    ":" +
    ("0" + setendTime.getMinutes()).slice(-2);
  let total = parseFloat(price) - parseFloat(discount);

  const updatedJob = await jobs.update({
    employeeId,
    serviceId,
    startTime,
    endTime,
    total,
  },{
    where:{
      id:jobId
    }
  });

  return res.json(
    returnFunction("1", "Service Edit Successfully!", { }, "")
  );
};
