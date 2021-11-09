const cheerio = require("cheerio");
const rp = require("request-promise");
const fs = require("fs");
const writeStream = fs.createWriteStream("Scraped_Truck_Data.csv");

//SAVE SCRAPED DATA INTO CSV
writeStream.write(
  `Item Id,Title,Price,Registration Date,Production Date,Mileage,Power \n`
);

(async () => {
  console.log("Please Wait.....");

  //GOTO THE INITIAL PAGE
  let url =
    "https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/od-2014/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%3Adesc";

  const response = await rp({
    uri: url,
  });

  let $ = cheerio.load(response);

  let pageList = [];

  $("ul.pagination-list > li > a > span").each((i, element) => {
    const $element = $(element);
    pageList.push($element.text());
  });

  //GET LAST PAGE NUMBER
  let lastPageNumber = parseInt(pageList[pageList.length - 1], 10);

  // GET THE EACH PAGE URL AND SEND URL TO THE ADDITEM FUNCTION
  for (let i = 1; i <= lastPageNumber; i++) {
    url = getNextPageUrl(i);
    await addItems(url, i);
  }

  console.log("Scraping Done......!!");
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
  const response = await rp({
    uri: url,
  });

  let $ = cheerio.load(response);

  const articleListNames = [];
  $("article.e1b25f6f16 > div > h2 > a").each((i, element) => {
    const $element = $(element);
    articleListNames.push($element.text());
  });

  //GET TOTAL ADD COUNT FOR EACH PAGE
  getTotalAdsCount(articleListNames, pageNumber);

  //GET THE TRUCK TITLE URL FOR TRUCK DETAILS
  let truckDetailsPageUrls = [];
  $("main.efjmewt5 > article > div >h2>a").each((i, element) => {
    const $element = $(element);
    truckDetailsPageUrls.push($element.attr("href"));
  });

  //LOOP THROUGH EACH TRUCK PAGE URL AND SEND IT TO SCAPRETRUCKITEM FUNCTION TO SCRAP TRUCK DATA
  console.log(`SCRAPING PAGE NO. ${pageNumber} TRUCK DATA`);
  for (let i = 0; i < truckDetailsPageUrls.length; i++) {
    const truckItemDetails = await scrapeTruckItem(truckDetailsPageUrls[i]);
    console.log(truckItemDetails);
    writeStream.write(
      `${truckItemDetails.item_id}, ${truckItemDetails.title}, ${truckItemDetails.price}, ${truckItemDetails.registration_date}, ${truckItemDetails.production_date}, ${truckItemDetails.mileage}, ${truckItemDetails.power} \n`
    );
  }
};

//GET THE TOTAL ADD FOR EACH PAGE
getTotalAdsCount = async (articleListNames, pageNumber) => {
  let totalAdCount = articleListNames.length;
  console.log(`Page no. ${pageNumber} has total ${totalAdCount} adds`);
};

//SCRAPE TRUCK ITEAM FOR INDIVIUAL TRUCK TITLE URL AND SCRAPE THE DATA FROM THAT PAGE
scrapeTruckItem = async (truckDetailsPageUrl) => {
  const response = await rp({
    uri: truckDetailsPageUrl,
  });

  let $ = cheerio.load(response);

  let item_id = "";
  let title = "";
  let price = "";
  let registration_date = "";
  let production_date = "";
  let mileage = "";
  let power = "";

  //GET THE ID
  let itemIdArray = [];
  $("#ad_id").each((i, element) => {
    const $element = $(element);
    itemIdArray.push($element.text());
  });
  item_id = itemIdArray[0];

  //GET THE TITLE
  let titleArray = [];
  $(".offer-title").each((i, element) => {
    const $element = $(element);
    titleArray.push($element.text());
  });
  title = titleArray[0].trim();

  //GET THE PRICE
  let priceArray = [];
  $("div.offer-price > span.offer-price__number").each((i, element) => {
    const $element = $(element);
    priceArray.push($element.text());
  });
  price = priceArray[0].trim().replace(/ /g, "");

  //GET THE FIRST UI ELEMENT ARRAY TO GET THE PRDUCTION_DATA,MILEAGE AND POWER DATA
  let firstUlElementArray = [];

  $("#parameters > ul:nth-child(1) > li").each((i, element) => {
    const $element = $(element);
    let data = [];
    data.push($(element).text().trim());
    data.map((e) =>
      e.includes("Rok produkcji")
        ? firstUlElementArray.push(e)
        : e.includes("Przebieg")
        ? firstUlElementArray.push(e)
        : e.includes("Moc")
        ? firstUlElementArray.push(e)
        : ""
    );
  });
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
  let secondUlElementArray = [];

  $("#parameters > ul:nth-child(2) > li").each((i, element) => {
    const $element = $(element);
    let data = [];
    data.push($(element).text().trim());
    data.map((e) =>
      e.includes("Pierwsza rejestracja") ? secondUlElementArray.push(e) : ""
    );
  });
  secondUlElementArray.map((e) => {
    if (e.length > 0) {
      registration_date = e.replace("Pierwsza rejestracja", "").trim();
    }
  });

  // THIS OBJECT REPRESENTS ALL THE DATA THAT NEEDS TO BE SCRAPED
  let truckAdDetails = {
    item_id,
    title,
    price,
    registration_date,
    production_date,
    mileage,
    power,
  };
  console.log(`Scraped "${truckAdDetails.title}" Truck`);
  return truckAdDetails;
};
