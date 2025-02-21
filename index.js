const puppeteer = require("puppeteer");
const libphonenumber = require("google-libphonenumber");
const XLSX = require("xlsx");

const BASE_URL = "https://infopark.in/companies/company?page=";

// Initialize phone number library
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
const PNF = libphonenumber.PhoneNumberFormat;

async function scrapeAllPages() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    let allCompanies = [];

    for (let i = 1; i <= 10; i++) {
        let url = `${BASE_URL}${i}`;
        console.log(`Scraping Page ${i}: ${url}`);
        const companies = await scrapePage(page, url);
        allCompanies = allCompanies.concat(companies);
    }

    // Apply formatting after scraping
    allCompanies = allCompanies.map(company => ({
        ...company,
        phone: formatPhoneNumber(company.phone)
    }));

    await browser.close();

    // Save to Excel
    saveToExcel(allCompanies);
}

// Function to scrape a single page
async function scrapePage(page, url) {
    try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Extract company names and phone numbers
        return await page.evaluate(() => {
            let data = [];
            document.querySelectorAll(".compy").forEach(company => {
                const name = company.querySelector("h5")?.innerText.trim() || "N/A";
                let phone = company.querySelector(".phone")?.innerText.replace(/[^0-9+]/g, "").trim() || "N/A";
                data.push({ name, phone });
            });
            return data;
        });
    } catch (error) {
        console.error(`❌ Error scraping ${url}:`, error);
        return [];
    }
}

// Function to format phone numbers
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber === "N/A" || phoneNumber === "0") return "Unknown Number";

    try {
        let country = detectCountryCode(phoneNumber) || "IN";
        let parsedNumber = phoneUtil.parseAndKeepRawInput(phoneNumber, country);

        if (phoneUtil.isValidNumber(parsedNumber)) {
            let nationalNumber = phoneUtil.format(parsedNumber, PNF.NATIONAL).replace(/\s+/g, "");
            let midIndex = Math.floor(nationalNumber.length / 2);
            return nationalNumber.slice(0, midIndex) + "-" + nationalNumber.slice(midIndex);
        }
    } catch (error) {
        return "Invalid Number";
    }
    return "Invalid Number";
}

// Function to detect country code from phone number prefix
function detectCountryCode(phoneNumber) {
    const countryPrefixes = {
        "+1": "US", "+44": "GB", "+91": "IN", "+33": "FR", "+49": "DE",
        "+61": "AU", "+81": "JP", "+86": "CN", "+39": "IT", "+7": "RU",
        "+34": "ES", "+55": "BR", "+27": "ZA", "+971": "AE", "+92": "PK",
        "+880": "BD", "+20": "EG", "+82": "KR", "+46": "SE", "+31": "NL"
    };

    for (const prefix in countryPrefixes) {
        if (phoneNumber.startsWith(prefix)) {
            return countryPrefixes[prefix];
        }
    }
    return null;
}

// Function to save data to Excel file
function saveToExcel(data) {
    // Convert data to a worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Create a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Company Data");

    // Write to file
    const fileName = "company_details.xlsx";
    XLSX.writeFile(wb, fileName);
    console.log(`✅ Data saved to ${fileName}`);
}

// Run the script
scrapeAllPages();
