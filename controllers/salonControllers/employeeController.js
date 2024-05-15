const { Op } = require("sequelize");
const fs = require("fs").promises;
const {
  user,
  employee,
  time,
  service,
  employeeService,
  otpVerification,
  deviceToken,
  wagesMethod,
  employeeWagesMethod,
  salonDetail,
  wallet,
  employeeAccess,
  employeeAccessDefault
  
} = require("../../models");
const jwt = require("jsonwebtoken");
const appError = require("../../utils/appError");
const Email = require("../../utils/Email");
const Convert = require("../../utils/dateManipulation");
const otpGenerator = require("otp-generator");
 
const { salonDetails } = require("../userControllers/customerController");

//! Return Function
let returnFunction = (status, message, data, error) => {
  return {
    status: `${status}`,
    message: `${message}`,
    data: data,
    error: `${error}`,
  };
};
/*
            1. All Employees of Salon
    ________________________________________
*/
exports.AllEmployees = async (req, res, next) => {
  const userId = req.user.id;
  // check if user with same eamil and phoneNum exists
  const salonDetails = await salonDetail.findOne({
    where: {
      userId,
    },

    attributes: ["id"],
  });
  const salonDetailId = salonDetails.id;
  const AllEmployess = await employee.findAll({
    where: {
      salonDetailId,
    },
    include: {
      model: user,
      attributes: ["id", "firstName", "lastName", "image"],
    },
  });
  return res.json(
    returnFunction("1", "All Employees of Salon", { AllEmployess }, "")
  );
};
/*
            1. Register Employee Manually(Employee data)
    ________________________________________
*/
exports.AddEmployee = async (req, res, next) => {
  const userId = req.user.id;
  const {
    firstName,
    lastName,
    email,
    phoneNum,
    countryCode,
    password,
    position,
  } = req.body;
  // check if user with same eamil and phoneNum exists
  const salonDetails = await salonDetail.findOne({
    where: {
      userId,
    },
    include: {
      model: time,
      attributes: ["id", "day", "openingTime", "closingTime", "status"],
    },
    attributes: ["id"],
  });
  const salonDetailId = salonDetails.id;
  const userExist = await user.findOne({
    where: {
      [Op.or]: [
        { email: email },
        { [Op.and]: [{ countryCode: countryCode }, { phonenum: phoneNum }] },
      ],
      deletedAt: { [Op.is]: null },
    },
  });

  //return res.json(userExist)
  if (userExist) {
    if (email === userExist.email)
      return next(
        new appError("Users exists,The email you entered is already taken", 200)
      );
    else if (phoneNum === userExist.phoneNum) {
      return next(
        new appError(
          "Users exists,The Phone Number you entered is already taken",
          200
        )
      );
    }else if ([1, 2, 4].includes(userExist.userTypeId)) { // check if there is already user with the same Email in relative apps
      return next(
        new appError(
          "Trying to login?,A Customer with the follwoing email exists ",
          200
        )
      );
    }
    const employeeData = await employee.findOne({
      where: {
        userId: userExist.id,
      },
    });

    return res.json(
      returnFunction(
        "1",
        "Employee Details Added Successfully!",
        { employeeId: employeeData.id },
        ""
      )
    );
  } else {
    let DT = new Date();
    // if No User Exist with the same email create new user
    let newEntry = await user.create({
      firstName,
      lastName,
      email,
      phoneNum,
      countryCode,
      status: true,
      password,
      verfiedAt: DT,
      signedFrom: "email",
      userTypeId: 3,
    });
    // save  Employee data in the table by creating new entry
    const employeeData = await employee.create({
      position,
      userId: newEntry.id,
      salonDetailId,
    });

    const employeeWallet = await wallet.create({
      employeeId:employeeData.id
    })

    salonDetails.times.map(async (dat) => {
      const newTime = new time();
      newTime.openingTime = dat.openingTime;
      newTime.closingTime = dat.closingTime;
      newTime.day = dat.day;
      newTime.employeeId = employeeData.id;
      await newTime.save();
    });
    // Handling the uploaded pictures
    if (req.file) {
      let tmpprofileImage = req.file.path;
      let profileImageName = tmpprofileImage.replace(/\\/g, "/");
      let userUpdate = await newEntry.update(
        { image: profileImageName },
        { where: { id: newEntry.id } }
      );
    }

    return res.json(
      returnFunction(
        "1",
        "Employee Details Added Successfully!",
        { employeeId: employeeData.id },
        ""
      )
    );
  }
};
/*
            2.Get Employee Timings 
    ________________________________________
*/
exports.getEmployeeTiming = async (req, res, next) => {
  const { employeeId } = req.body;
  // ittirating an array and creating the entries of salon timings
  const employeeTiming = await time.findAll({
    where: {
      employeeId,
    },
    attributes: ["id", "day", "openingTime", "closingTime", "status"],
  });
  employeeTiming.forEach((timeSlot) => {
    timeSlot.openingTime =
      timeSlot.openingTime == "00:00:01"
        ? ""
        : Convert.convertTo12HourFormat(timeSlot.openingTime);
    timeSlot.closingTime =
      timeSlot.closingTime == "24:00:00"
        ? ""
        : Convert.convertTo12HourFormat(timeSlot.closingTime);
  });
  return res.json(
    returnFunction("1", "Employee Timing", { employeeTiming }, "")
  );
};
/*
            3.Get Salon Services
    ________________________________________
*/
exports.getServices = async (req, res, next) => {
  const userId = req.user.id;

  const serviceData = await service.findAll({
    include: {
      model: salonDetail,
      where: {
        userId,
      },
      attributes: [],
    },
  });

  return res.json(
    returnFunction("1", "Services of Salon", { serviceData }, "")
  );
};
/*
            4.Add Employee Services
    ________________________________________
*/
exports.addEmployeeService = async (req, res, next) => {
  const userId = req.user.id;
  const SalonDetail = await salonDetail.findOne({
    where: { userId },
  });
  const { serviceIds, employeeId, salonDetailId } = req.body;
  // ittirating the array and add the srevices of employee
  serviceIds.map(async (dat) => {
    const newService = new employeeService();
    newService.serviceId = dat.id;
    newService.employeeId = employeeId;
    newService.salonDetailId = SalonDetail.id;
    await newService.save();
  });
  return res.json(returnFunction("1", "Services of Employee", {}, ""));
};
/*
            3.get Wages Method
    ________________________________________
*/
exports.getWagesMethod = async (req, res, next) => {
  const WagesMethod = await wagesMethod.findAll({
    attributes: ["id", "methodName"],
  });

  return res.json(
    returnFunction("1", "Services of Salon", { WagesMethod }, "")
  );
};
/*
            4.Add wages method
    ________________________________________
*/
exports.addWagesMethod = async (req, res, next) => {
  const { wagesMethodId, employeeId, value } = req.body;
  const employeeData = await employee.findByPk(employeeId);
  const method = await employeeWagesMethod.create({
    wagesMethodId,
    employeeId,
    value,
  });
  return res.json(
    returnFunction("1", "Wages Method Added Successfully!", {}, "")
  );
};
/*
            4.Employee Detail
    ________________________________________
*/
exports.employeeDetail = async (req, res, next) => {
  const employeeId = req.body.employeeId;
  const employeeData = await employee.findByPk(employeeId, {
    include: [
      {
        model: user,
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "countryCode",
          "phoneNum",
          "image",
        ],
      },
      { model: salonDetail, attributes: ["coverImage"] },
      {
        model: employeeWagesMethod,
        include: { model: wagesMethod, attributes: ["methodName"] },
        attributes: ["id", "value"],
      },
      {
        model: employeeService,
        include: { model: service, attributes: ["id", "serviceName"] },
        attributes: ["status"],
      },
      {
        model: time,
        attributes: ["id", "day", "openingTime", "closingTime", "status"],
      },
    ],
    attributes: ["id", "position"],
  });
  // Convert opening and closing times to 12-hour format
  employeeData.times.forEach((timeSlot) => {
    timeSlot.openingTime =
      timeSlot.openingTime == "00:00:01"
        ? "":timeSlot.openingTime == null
        ? ""
        : Convert.convertTo12HourFormat(timeSlot.openingTime);
    timeSlot.closingTime =
      timeSlot.closingTime == "24:00:00"
        ? "":timeSlot.closingTime == null
        ? ""
        : Convert.convertTo12HourFormat(timeSlot.closingTime);
  });
  return res.json(returnFunction("1", "Employee Deyails", employeeData, ""));
};
/*
            4.Update Employee Detail
    ________________________________________
*/
exports.updateEmployee = async (req, res, next) => {
  const { firstName, lastName, position, employeeId } = req.body;
  let employeeData = await employee.findByPk(employeeId, {
    include: {
      model: user,
      attributes: ["id", "firstName", "lastName", "image"],
    },
    attributes: ["id", "position"],
  });
  if (req.file) {
    if (employeeData.user.image == "") {
      let tmpprofileImage = req.file.path;
      let profileImageName = tmpprofileImage.replace(/\\/g, "/");
      let userUpdate = await user.update(
        { image: profileImageName },
        { where: { id: employeeData.user.id } }
      );
    } else {
      let tmpprofileImage = req.file.path;
      let profileImageName = tmpprofileImage.replace(/\\/g, "/");
      fs.unlink(employeeData.user.image, async (err) => {
        if (err) {
          console.error(`Error deleting file: ${err.message}`);
        } else {
          console.log("Picture Deleted Successfully!");
        }
      });
      await user.update(
        { image: profileImageName },
        { where: { id: employeeData.user.id } }
      );
    }
  }
  await user.update(
    {
      firstName,
      lastName,
    },
    {
      where: { id: employeeData.user.id },
    }
  );
  (employeeData.position = position ?? employeeData.position),
    await employeeData.save();

  return res.json(
    returnFunction("1", "Employee Updated Successfully!", {}, "")
  );
};
/*
            4.Update Employee Timings
    ________________________________________
*/
exports.updateEmployeTimings = async (req, res, next) => {
  const { employeeId, timeData } = req.body;

  timeData.map(async (dat) => {
    let timeTable = await time.findOne({
      where: [{ employeeId }, { day: dat.day }],
    });
    if (timeTable) {
      timeTable.openingTime =
        dat.openingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.openingTime)
          : !dat.status
            ? null
            : "00:00:01";
      timeTable.closingTime =
        dat.closingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.closingTime)
          : !dat.status
            ? null
            : "24:00:00";
      timeTable.status = dat.status;
      await timeTable.save();
    } else {
      const newTime = new time();
      newTime.openingTime =
        dat.openingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.openingTime)
          : !dat.status
            ? null
            : "00:00:01";
      newTime.closingTime =
        dat.closingTime && dat.status
          ? Convert.convertTo24HourFormat(dat.closingTime)
          : !dat.status
            ? null
            : "24:00:00";
      newTime.day = dat.day;
      newTime.employeeId = employeeId;
      await newTime.save();
    }
  });
  return res.json(
    returnFunction("1", "Employee Timings Updated Successfully!", {}, "")
  );
};
/*
            5.Update Employee Service
    ________________________________________
*/
exports.updateEmployeeService = async (req, res, next) => {
  const userId = req.user.id;
  const SalonDetail = await salonDetail.findOne({
    where: { userId },
  });
  const { serviceIds, employeeId } = req.body;

  serviceIds.map(async (dat) => {
    let serviceData = await employeeService.findOne({
      where: [{ employeeId }, { serviceId: dat.id }],
    });
    if (serviceData) {
      serviceData.status = dat.status;
      serviceData.salonDetailId = SalonDetail.id;
      await serviceData.save();
    } else {
      let newService = new employeeService();
      newService.employeeId = employeeId;
      newService.serviceId = dat.id;
      newService.status = dat.status;
      newService.salonDetailId = SalonDetail.id;
      await newService.save();
    }
  });
  return res.json(
    returnFunction("1", "Employee Services Updated Successfully!", {}, "")
  );
};
/*
            5.Update Employee Wages Method
    ________________________________________
*/
exports.updateWagesMethod = async (req, res, next) => {
  const { employeeId, wagesMethodId, value } = req.body;
  let method = await employeeWagesMethod.findOne({
    where: {
      employeeId,
    },
  });
  if (method) {
    (method.wagesMethodId = wagesMethodId),
      (method.value = value),
      await method.save();
  } else {
    await employeeWagesMethod.create({
      employeeId,
      wagesMethodId,
      value,
    });
  }
  return res.json(
    returnFunction("1", "Employee Wages Method Updated Successfully!", {}, "")
  );
};

/*
            6.Add Accesslevels
    ________________________________________
*/

exports.addOrUpdateAccessleves = async (req, res, next) => {
  const { employeeId, accesslevels } = req.body;

 await employeeAccess.destroy({
    where: { employeeId },
  });

  accesslevels.forEach(el=> el.employeeId = employeeId);

  employeeAccess.bulkCreate(accesslevels);
 
  return res.json(
    returnFunction("1", "success", {}, "")
  );
};

/*
            7.Add Accesslevels
    ________________________________________
*/

exports.fetchAccesslevels = async (req, res, next) => {
  const { employeeId } = req.params;
  const accesslevels = await employeeAccess.findAll({
    where: {
      employeeId,
    },
    attributes: { exclude: ['createdAt','updatedAt','employeeId'] },
  })
  return res.json(
    returnFunction("1", "success", {accesslevels}, "")
  );
};


//*8.Fecth Default Accesslevels

exports.fetchDefaultAccesslevels = async (req, res, next) => {
  const { salonDetailId } = req.params;

  let accesslevels = await employeeAccessDefault.findAll({
    where: {
      salonDetailId,
    },
    attributes: { exclude: ['createdAt','updatedAt','salonDetailId','id','status'] },
  })

  if(!accesslevels || accesslevels.length < 1 ){
      accesslevels = [
        {
            "access": "Reschedule\nAppointments",
            "key": "appointments",
            "level": "none"
        },
        {
            "access": "Team\nMember",
            "key": "teamMember",
            "level": "none"
        },
        {
            "access": "Can Book\nAppointments",
            "key": "bookAppointments",
            "level": "none"
        },
        {
            "access": "Can Apply Discounts\nTo Appointments",
            "key": "applyDiscount",
            "level": "none"
        },
        {
            "access": "Clients",
            "key": "client",
            "level": "none"
        },
        {
            "access": "Services",
            "key": "services",
            "level": "none"
        },
        {
            "access": "Client\nFeedback",
            "key": "feedback",
            "level": "none"
        },
        {
            "access": "Manage\nDeals",
            "key": "manageDeals",
            "level": "none"
        }
    ]
  }

  return res.json(
    returnFunction("1", "success", {accesslevels}, "")
  );
};

//*8.Add or update Default Accesslevels
exports.addOrUpdateDefaultAccessleves = async (req, res, next) => {
  const {salonDetailId , accesslevels } = req.body;

 await employeeAccessDefault.destroy({
  where: {
    salonDetailId,
  },
 });

 accesslevels.forEach(el=> el.salonDetailId = salonDetailId);
 employeeAccessDefault.bulkCreate(accesslevels);
   return res.json(
    returnFunction("1", "success", {}, "")
  );
};
 