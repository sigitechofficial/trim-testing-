module.exports = (sequelize, DataTypes) => {
    const noShowPolicy = sequelize.define('noShowPolicy', {
      refundPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }
    });

    noShowPolicy.associate = models => {
        models.salonDetail.hasMany(noShowPolicy);
        noShowPolicy.belongsTo(models.salonDetail);
      };
    return noShowPolicy;
  };