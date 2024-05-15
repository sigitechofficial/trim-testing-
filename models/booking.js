module.exports = (sequelize, DataTypes) => {
  const booking = sequelize.define("booking", {
    status: {
      type: DataTypes.ENUM("pending", "book", "complete", "cancel", "no-show","save-unpaid"),
      allowNull: false,
      defaultValue: "book",
    },
    subTotal: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discount: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    initialPayment: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    actualCapturedAmount: {
      // after complete , cancel or no-show
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    finalPayment: {
      type: DataTypes.ENUM("paid", "unpaid"),
      allowNull: false,
      defaultValue: "unpaid",
    },
    promoCode: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    reScheduleCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    on: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    tip: {
      type: DataTypes.DECIMAL(20, 2),
      defaultValue: 0,
    },
    stripeCardId: {
      type: DataTypes.STRING(),
      allowNull: true,
    },
    initialPaymentIntend: {
      type: DataTypes.STRING(),
      allowNull: true,
    },
    finalPaymentIntend: {
      type: DataTypes.STRING(),
      allowNull: true,
    },
    upFrontPaymentPercentage: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING(),
      allowNull: true,
    },
    paymentMethod: {
      type: DataTypes.ENUM("card", "cash"),
      allowNull: false,
      defaultValue: "card",
    },
    rating: {
      type: DataTypes.ENUM("pending", "done", "skiped", "cancel"),
      allowNull: false,
      defaultValue: "pending",
    },
    clientRemoved: {
      type: DataTypes.BOOLEAN,
      defaultValue:false
    },
  });

  booking.associate = (models) => {
    models.user.hasMany(booking, { foreignKey: "customerId" });
    booking.belongsTo(models.user, { foreignKey: "customerId" });

    models.salonDetail.hasMany(booking);
    booking.belongsTo(models.salonDetail);

    booking.hasMany(models.bookingHistory);
    models.bookingHistory.belongsTo(booking);

    booking.hasOne(models.cancelledBooking);
    models.cancelledBooking.belongsTo(booking);

    booking.hasMany(models.rating);
    models.rating.belongsTo(booking);
  };

  return booking;
};
