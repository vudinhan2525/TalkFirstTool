import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const LOGIN_URL = "https://service.talkfirst.vn/v1/api/account/student/login";
const REGISTER_URL = "https://service.talkfirst.vn/v1/api/student/lesson/register";

const CRON_USER = "vudinhan000@gmail.com";
const CRON_PASS = "DoibuonJQK123!";

const LESSON_IDS = [
    "a4732cd7-2000-40ce-be66-9449ecc427b1",
    "48609221-c124-4d27-b329-8f55510e306e",
    "c763d928-102c-4dcc-aaac-616b7b02b09a",
    "bd5d9c7d-e15d-4687-94aa-4dc90d47f1ff",
];

async function retryRequest(fn, retries = 3, delay = 2000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            if (i > 0) console.log(`Retry ${i + 1}/${retries}...`);
            return await fn();
        } catch (err) {
            lastError = err;
            const shouldRetry =
                !err.response || (err.response.status >= 500 && err.response.status < 600);

            if (!shouldRetry) throw err;

            console.warn(
                `Error ${i + 1}: ${err.message || err.response?.data?.message}`
            );
            if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastError;
}

app.get("/run-all", async (req, res) => {
    try {
        const { data: loginData } = await axios.post(LOGIN_URL, {
            username: CRON_USER,
            password: CRON_PASS,
        });

        const token = loginData.data?.token;
        if (!token) throw new Error("Cannot obtain auth token");

        console.log("Login successful. Token obtained.");

        const results = [];

        for (const id of LESSON_IDS) {
            try {
                const { data } = await retryRequest(
                    () =>
                        axios.post(
                            REGISTER_URL,
                            { lessonId: id },
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                    Origin: "https://student.talkfirst.vn",
                                    Referer: "https://student.talkfirst.vn/",
                                },
                                timeout: 10000,
                            }
                        ),
                    3,
                    2000
                );

                console.log(`Success: ${id}`);
                results.push({ lessonId: id, status: "OK", data });
            } catch (err) {
                const errorMsg = err.response?.data || err.message;
                console.error(`Failed: ${id}`, errorMsg);

                results.push({
                    lessonId: id,
                    status: "FAIL",
                    error: errorMsg,
                });
            }
        }

        res.json({
            success: true,
            message: "Done",
            results,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/run-all`);
});
