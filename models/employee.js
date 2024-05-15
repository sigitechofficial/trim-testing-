// employee.js
module.exports = (sequelize, DataTypes) => {
  const employee = sequelize.define('employee', {
    position: {
      type: DataTypes.STRING(),
      allowNull: true
    },
    description: {
      type: DataTypes.STRING(),
      allowNull: true
    },
    coverImage: {
      type: DataTypes.STRING(),
      allowNull: true
    }
  });

  employee.associate = models => {
    models.user.hasMany(employee);
    employee.belongsTo(models.user);

    employee.hasMany(models.rating);
    models.rating.belongsTo(employee);

    employee.hasMany(models.employeeAccess);
    models.employeeAccess.belongsTo(employee);

  };

  return employee;
};
