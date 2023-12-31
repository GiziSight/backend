const conn = require('../dbConnection').promise();
const moment = require('moment');
const AKGPerempuan = require('../dataAKGPerempuan.json');
const AKGLaki = require('../dataAKGLaki.json');

exports.getUser = async (req, res, next) => {
    try {
        const user = req.query

        const [row] = await conn.execute(
            "SELECT `id`,`username`,`email`,`gender`,`birthdate`,`height`,`weight` FROM `users` WHERE `email`=?",
            [user.email]
        );
        if (row.length > 0) {
            const userData = row[0];
            const birthdate = moment(userData.birthdate);
            const now = moment();
            const userAgeYears = now.diff(birthdate, 'years');
            const userAgeMonths = now.diff(birthdate, 'months');
            const userAgeWeeks = now.diff(birthdate, 'weeks');

            delete userData.birthdate;

            let userAge;
            if (userAgeYears > 0) {
                userAge = userAgeYears + ' tahun';
            } else if (userAgeMonths > 0) {
                userAge = userAgeMonths + ' bulan';
            } else {
                userAge = userAgeWeeks + ' minggu';
            }

            userData.age = userAge;

            const userGender = userData.gender.toLowerCase();

            let akgData = {};
            if (userGender === 'female') {
                akgData = AKGPerempuan.find(item => {
                    const ageRange = item.Usia.split(' - ');
                    const [minAgeStr, maxAgeStr] = ageRange;
                    const [minAge, maxAge] = [parseAge(minAgeStr), parseAge(maxAgeStr)];

                    return isUserAgeWithinRange(userAgeYears, userAgeMonths, userAgeWeeks, minAge, maxAge);
                });
            } else if (userGender === 'male') {
                akgData = AKGLaki.find(item => {
                    const ageRange = item.Usia.split(' - ');
                    const [minAgeStr, maxAgeStr] = ageRange;
                    const [minAge, maxAge] = [parseAge(minAgeStr), parseAge(maxAgeStr)];

                    return isUserAgeWithinRange(userAgeYears, userAgeMonths, userAgeWeeks, minAge, maxAge);
                });
            } else {
                return res.status(404).json({ message: "Data AKG tidak ditemukan untuk jenis kelamin ini" });
            }

            if (akgData) {
                const nutritionalComponents = Object.keys(akgData);

                const firstFourComponents = nutritionalComponents.slice(0, 4);
                const firstFourData = [{
                    "userInfo": firstFourComponents.map(component => ({
                        "name": component,
                        "nilai": akgData[component]
                    }))
                }];

                // Filter out excluded items
                const excludedItems = ["Gender", "Usia", "TB", "BB"];
                const groupSizes = [8, 12, 13]; // Adjusted group sizes
                const filteredComponents = nutritionalComponents.filter(component => !excludedItems.includes(component));

                // Split the nutritional components into groups of specified sizes
                const groupedComponents = [];
                let currentIndex = 0;
                groupSizes.forEach(size => {
                    const group = filteredComponents.slice(currentIndex, currentIndex + size);
                    groupedComponents.push(group);
                    currentIndex += size;
                });

                // Generate object for each group
                const dictionaries = groupedComponents.map((group, index) => {
                    const bagianKey = `bagian${index + 1}`;
                    let componentsInGroup;

                    // Specify components for each bagian
                    switch (index + 1) {
                        case 1:
                            componentsInGroup = [ "Karbohidrat", "Protein", "Lemak Total", "Omega 3", "Omega 6", "Air", "Energi", "Serat"];
                            break;
                        case 2:
                            componentsInGroup = ["Kolina", "Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E", "Vitamin K", "Vitamin B1 (Thiamine)", "Vitamin B2 (Riboflavin)", "Vitamin B3 (Niasin)", "Vitamin B5 (Asam Pantotenat)", "Vitamin B6 (Piridoksina)", "Vitamin B7 (Biotin)", "Vitamin B9 (Folat)", "Vitamin B12 (Kobalamin)"];
                            break;
                        case 3:
                            componentsInGroup = ["Besi", "Fluor", "Fosfor", "Klorin", "Kalium", "Kalsium", "Kromium", "Yodium", "Magnesium", "Mangan", "Natrium", "Seng", "Selenium", "Tembaga"];
                            break;
                        default:
                            componentsInGroup = [];
                    }

                    componentsInGroup = componentsInGroup.map(component => ({
                        "name": component,
                        "nilai": akgData[component]
                    }));

                    return {
                        [bagianKey]: componentsInGroup
                    };
                });


                const nutrition = Object.assign({}, ...dictionaries);
                const personalInformation = Object.assign({}, ...firstFourData);

                return res.json({ user: userData, personalData: personalInformation, akgData: nutrition });
            } else {
                return res.status(404).json({ message: "Data AKG tidak ditemukan untuk rentang usia pengguna" });
            }
        } else {
            return res.status(404).json({ message: "Pengguna tidak ditemukan" });
        }

    }
    catch (err) {
        next(err);
    }

    function parseAge(ageStr) {
        const [age, unit] = ageStr.split(' ');
        return { age: parseInt(age, 10), unit };
    }

    function isUserAgeWithinRange(userYears, userMonths, userWeeks, minAge, maxAge) {
        if (maxAge.unit === 'tahun') {
            return userYears >= minAge.age && userYears <= maxAge.age;
        } else if (maxAge.unit === 'bulan') {
            return userMonths >= minAge.age && userMonths <= maxAge.age;
        } else if (maxAge.unit === 'minggu') {
            return userWeeks >= minAge.age && userWeeks <= maxAge.age;
        }
        return false;
    }
}
