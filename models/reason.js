module.exports = (sequelize, DataTypes) =>{
    const reason = sequelize.define('reason', {
        reason: {
            type: DataTypes.STRING(),
            allowNull: true
        }
    });

    reason.associate = (models)=>{   
        reason.hasMany(models.cancelledBooking);
        models.cancelledBooking.belongsTo(reason);

    };

    return reason;
};