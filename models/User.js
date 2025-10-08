const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    car: {
        make: { type: String, default: '' },
        model: { type: String, default: '' },
        extraLoad: { type: String, default: 'none' },

    }

});

module.exports = mongoose.model("User", userSchema);
