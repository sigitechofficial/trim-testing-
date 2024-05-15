module.exports = (sequelize, DataTypes) => {
    const cancellationPolicy = sequelize.define('cancellationPolicy', {
      hoursBeforeBooking: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24,
      },
      refundPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
      }
    });

    cancellationPolicy.associate = models => {
        models.salonDetail.hasMany(cancellationPolicy);
        cancellationPolicy.belongsTo(models.salonDetail);
      };
    return cancellationPolicy;
  };