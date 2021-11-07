const puppeteer = require("puppeteer");
const fs = require("fs");
const writeStream = fs.createWriteStream("Scraped_Truck_Data.csv");

//SAVE SCRAPED DATA INTO CSV
writeStream.write(
  `Item Id,Title,Price,Registration Date,Production Date,Mileage,Power \n`
);

(async () => {
  console.log("Please Wait..... Pappeteer is Launching.");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);

  //GOTO THE INITIAL PAGE
  await page.goto(
    "https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/od-2014/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%3Adesc"
  );

  //GET LAST PAGE NUMBER
  const pageList = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("ul.pagination-list > li > a > span")
    ).map((e) => e.outerText)
  );
  let lastPageNumber = parseInt(pageList[pageList.length - 1], 10);
  await browser.close();

  // GET THE EACH PAGE URL AND SEND URL TO THE ADDITEM FUNCTION
  for (let i = 1; i <= lastPageNumber; i++) {
    url = getNextPageUrl(i);
    await addItems(url, i);
  }

  console.log("Scraping Done");
})();

//MAKE THE URL FOR EACH PAGE
getNextPageUrl = (pageNumber) => {
  if (pageNumber === 1) {
    url =
      "https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/od-2014/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%3Adesc";
  } else {
    url = `https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/od-2014/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%3Adesc&page=${pageNumber}`;
  }
  return url;
};

//GET THE URL AND FETCH EACH PAGE
addItems = async (url, pageNumber) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto(url);

  const articleListNames = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("article.e1b25f6f16 > div > h2 > a")
    ).map((e) => e.outerText)
  );

  //GET TOTAL ADD COUNT FOR EACH PAGE
  getTotalAdsCount(articleListNames, pageNumber);

  //GET THE TRUCK TITLE URL FOR TRUCK DETAILS
  let truckDetailsPageUrls = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("main.efjmewt5 > article > div >h2>a")
    ).map((e) => e.href)
  );

  //LOOP THROUGH EACH TRUCK PAGE URL AND SEND IT TO SCAPRETRUCKITEM FUNCTION TO SCRAP TRUCK DATA
  console.log(`SCRAPING PAGE NO. ${pageNumber} TRUCK DATA`);
  for (let i = 0; i < truckDetailsPageUrls.length; i++) {
    const truckItemDetails = await scrapeTruckItem(truckDetailsPageUrls[i]);
    console.log(truckItemDetails);
    writeStream.write(
      `${truckItemDetails.item_id}, ${truckItemDetails.title}, ${truckItemDetails.price}, ${truckItemDetails.registration_date}, ${truckItemDetails.production_date}, ${truckItemDetails.mileage}, ${truckItemDetails.power} \n`
    );
  }
  await browser.close();
};

//GET THE TOTAL ADD FOR EACH PAGE
getTotalAdsCount = async (articleListNames, pageNumber) => {
  let totalAdCount = articleListNames.length;
  console.log(`Page no. ${pageNumber} has total ${totalAdCount} adds`);
};

//SCRAPE TRUCK ITEAM FOR INDIVIUAL TRUCK TITLE URL AND SCRAPE THE DATA FROM THAT PAGE
scrapeTruckItem = async (truckDetailsPageUrl) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto(truckDetailsPageUrl);

  let registration_date = "";
  let production_date = "";
  let mileage = "";
  let power = "";

  //GET THE FIRST UI ELEMENT ARRAY TO GET THE PRDUCTION_DATA,MILEAGE AND POWER DATA
  let firstUlElementArray = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#parameters > ul:nth-child(1) > li"))
      .map((e) => e.outerText)
      .map((e) =>
        e.includes("Rok produkcji")
          ? e
          : e.includes("Przebieg")
          ? e
          : e.includes("Moc")
          ? e
          : ""
      )
  );

  firstUlElementArray.map((e) => {
    if (e.includes("Rok produkcji")) {
      production_date = e.replace("Rok produkcji", "").trim();
    }
    if (e.includes("Przebieg")) {
      mileage = e.replace("Przebieg", "").trim();
    }
    if (e.includes("Moc")) {
      power = e.replace("Moc", "").trim();
    }
  });

  //GET THE SECOND UI ELEMENT ARRAY TO GET THE REGISTRATION DATE
  let secondUlElementArray = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#parameters > ul:nth-child(2) > li"))
      .map((e) => e.outerText)
      .map((e) => (e.includes("Pierwsza rejestracja") ? e : ""))
  );

  secondUlElementArray.map((e) => {
    if (e.length > 0) {
      registration_date = e.replace("Pierwsza rejestracja", "").trim();
    }
  });

  // THIS OBJECT REPRESENTS ALL THE DATA THAT NEEDS TO BE SCRAPED
  let truckAdDetails = {
    item_id: await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("#ad_id")).map(
          (e) => e.outerText
        )[0]
    ),
    title: await page.evaluate(() =>
      Array.from(document.querySelectorAll(".offer-title"))
        .map((e) => e.outerText)[0]
        .trim()
    ),
    price: await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(" div.offer-price > span.offer-price__number")
      )
        .map((e) => e.outerText)[1]
        .trim()
        .replace(/ /g, "")
    ),
    registration_date,
    production_date,
    mileage,
    power,
  };
  console.log(`Scraped "${truckAdDetails.title}" Truck`);
  await browser.close();
  return truckAdDetails;
};
