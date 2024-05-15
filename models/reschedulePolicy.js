module.exports = (sequelize, DataTypes) => {
  const reschedulePolicy = sequelize.define("reschedulePolicy", {
    hoursBeforeBooking: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 24,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  reschedulePolicy.associate = (models) => {
    models.salonDetail.hasMany(reschedulePolicy);
    reschedulePolicy.belongsTo(models.salonDetail);
  };
  return reschedulePolicy;
};
