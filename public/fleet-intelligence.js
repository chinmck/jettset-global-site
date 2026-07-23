/* Fleet Intelligence prototype. Isolated to #fleetIntelligence. */
(function fleetIntelligence() {
  var root = document.getElementById("fleetIntelligence");
  if (!root) return;

  var locations = {
    london: { name: "London", lat: 51.5074, lon: -0.1278 },
    monaco: { name: "Monaco", lat: 43.7384, lon: 7.4246 },
    paris: { name: "Paris", lat: 48.8566, lon: 2.3522 },
    milan: { name: "Milan", lat: 45.4642, lon: 9.19 },
    geneva: { name: "Geneva", lat: 46.2044, lon: 6.1432 },
    dubai: { name: "Dubai", lat: 25.2048, lon: 55.2708 },
    doha: { name: "Doha", lat: 25.2854, lon: 51.531 },
    lagos: { name: "Lagos", lat: 6.5244, lon: 3.3792 },
    accra: { name: "Accra", lat: 5.6037, lon: -0.187 },
    "new york": { name: "New York", lat: 40.7128, lon: -74.006 },
    miami: { name: "Miami", lat: 25.7617, lon: -80.1918 },
    toronto: { name: "Toronto", lat: 43.6532, lon: -79.3832 },
    "los angeles": { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
    singapore: { name: "Singapore", lat: 1.3521, lon: 103.8198 },
    "hong kong": { name: "Hong Kong", lat: 22.3193, lon: 114.1694 },
    tokyo: { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
    "cape town": { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
    johannesburg: { name: "Johannesburg", lat: -26.2041, lon: 28.0473 }
  };

  /* Matches the validated Journey Visualised bands without modifying its live
     implementation. Capacity can conservatively move a result up one or more
     categories; priorities are applied only after route and capacity. */
  var categories = [
    {
      name: "Light Jet",
      maxNm: 1500,
      capacity: 6,
      range: "Up to 1,500 nm",
      capacityLabel: "Up to 6 travellers",
      ideal: "Regional city pairs",
      representative: "Citation CJ3",
      cabinHeight: "Approx. 4 ft 9 in",
      luggageSummary: "Personal luggage",
      cabinLayout: "Club seating; configuration varies",
      cabinLength: "Approx. 15–18 ft",
      cabinWidth: "Approx. 4 ft 10 in",
      cruise: "Approx. 400–430 kt; validation required",
      catering: "Light catering; confirmed during sourcing",
      wifi: "Available on selected aircraft",
      wc: "Varies by aircraft and configuration",
      attendant: "Not typically included; confirmed during sourcing",
      cabin: "An intimate, composed cabin for focused short-haul travel and efficient movement between regional airports.",
      luggage: "Best suited to considered personal luggage. Larger or specialist baggage should be reviewed before aircraft selection.",
      silhouette: "fi-aircraft-light"
    },
    {
      name: "Midsize Jet",
      maxNm: 2500,
      capacity: 8,
      range: "Up to 2,500 nm",
      capacityLabel: "Up to 8 travellers",
      ideal: "Longer regional journeys",
      representative: "Citation Latitude",
      cabinHeight: "Approx. 5 ft 8 in–6 ft",
      luggageSummary: "Standard personal luggage",
      cabinLayout: "Club seating with divan options; varies",
      cabinLength: "Approx. 17–21 ft",
      cabinWidth: "Approx. 5 ft 6 in–6 ft 5 in",
      cruise: "Approx. 420–460 kt; validation required",
      catering: "Cold catering commonly available; sourcing confirms",
      wifi: "Available on selected aircraft",
      wc: "Typically enclosed; confirmed during sourcing",
      attendant: "Usually not included; may be arranged",
      cabin: "A more generous cabin with room to settle into longer regional sectors, work privately and travel without excess.",
      luggage: "Suitable for standard personal luggage across a small travelling party, subject to the aircraft sourced.",
      silhouette: "fi-aircraft-midsize"
    },
    {
      name: "Super-Midsize Jet",
      maxNm: 3500,
      capacity: 10,
      range: "Up to 3,500 nm",
      capacityLabel: "Up to 10 travellers",
      ideal: "Transcontinental journeys",
      representative: "Challenger 350",
      cabinHeight: "Approx. 6 ft",
      luggageSummary: "Extended-stay luggage",
      cabinLayout: "Two-zone club and divan layouts; varies",
      cabinLength: "Approx. 24–28 ft",
      cabinWidth: "Approx. 7 ft",
      cruise: "Approx. 450–480 kt; validation required",
      catering: "Enhanced catering capability varies by galley",
      wifi: "Available on selected aircraft",
      wc: "Typically enclosed; confirmed during sourcing",
      attendant: "Available by arrangement on selected aircraft",
      cabin: "A stand-up cabin character with meaningful workspace, comfort and baggage flexibility for longer sectors.",
      luggage: "Well suited to extended-stay luggage for a considered group; specialist items remain subject to review.",
      silhouette: "fi-aircraft-super-midsize"
    },
    {
      name: "Heavy Jet",
      maxNm: 5500,
      capacity: 14,
      range: "Up to 5,500 nm",
      capacityLabel: "Up to 14 travellers",
      ideal: "Long-haul and larger parties",
      representative: "Gulfstream G450",
      cabinHeight: "Approx. 6 ft 2 in",
      luggageSummary: "Generous long-stay guidance",
      cabinLayout: "Multiple cabin zones; layouts vary",
      cabinLength: "Approx. 40–45 ft",
      cabinWidth: "Approx. 7 ft 4 in",
      cruise: "Approx. 470–500 kt; validation required",
      catering: "Full galley capability on selected aircraft",
      wifi: "Commonly available; service varies",
      wc: "Typically enclosed; configuration varies",
      attendant: "Often available or required; confirmed during sourcing",
      cabin: "A substantial long-haul cabin designed around movement, work, dining and considered rest across extended journeys.",
      luggage: "Generous hold guidance for longer stays and larger groups, confirmed against payload and aircraft configuration.",
      silhouette: "fi-aircraft-heavy"
    },
    {
      name: "Ultra Long Range",
      maxNm: Infinity,
      capacity: 16,
      range: "5,500+ nm capability",
      capacityLabel: "Up to 16 travellers",
      ideal: "Intercontinental travel",
      representative: "Global 7500",
      cabinHeight: "Approx. 6 ft 2 in–6 ft 4 in",
      luggageSummary: "Substantial intercontinental guidance",
      cabinLayout: "Three or four cabin zones; layouts vary",
      cabinLength: "Approx. 45–55 ft",
      cabinWidth: "Approx. 8 ft",
      cruise: "Approx. 480–510 kt; validation required",
      catering: "Full galley capability; menu confirmed personally",
      wifi: "Commonly available; coverage and service vary",
      wc: "Typically enclosed; some include two",
      attendant: "Commonly available; confirmed during sourcing",
      cabin: "A calm, zoned cabin environment intended for uninterrupted intercontinental movement, rest and arrival readiness.",
      luggage: "The strongest category guidance for extended journeys and substantial luggage, always reviewed against operational requirements.",
      silhouette: "fi-aircraft-ultra-long-range"
    }
  ];

  var originInput = root.querySelector("#fiOrigin");
  var destinationInput = root.querySelector("#fiDestination");
  var travellerSelect = root.querySelector("#fiTravellers");
  var status = root.querySelector("#fiRouteStatus");
  var categoryName = root.querySelector("#fiCategoryName");
  var match = root.querySelector("#fiMatch");
  var silhouette = root.querySelector("#fiAircraftSilhouette");
  var reason = root.querySelector("#fiReason");
  var range = root.querySelector("#fiRange");
  var capacity = root.querySelector("#fiCapacity");
  var representative = root.querySelector("#fiRepresentative");
  var representativeNote = root.querySelector("#fiRepresentativeNote");
  var cabinHeight = root.querySelector("#fiCabinHeight");
  var cabinHeightDetail = root.querySelector("#fiCabinHeightDetail");
  var luggageSummary = root.querySelector("#fiLuggageSummary");
  var cabin = root.querySelector("#fiCabin");
  var luggage = root.querySelector("#fiLuggage");
  var cabinLayout = root.querySelector("#fiCabinLayout");
  var cabinLength = root.querySelector("#fiCabinLength");
  var cabinWidth = root.querySelector("#fiCabinWidth");
  var rangeDetail = root.querySelector("#fiRangeDetail");
  var cruise = root.querySelector("#fiCruise");
  var catering = root.querySelector("#fiCatering");
  var wifi = root.querySelector("#fiWifi");
  var wc = root.querySelector("#fiWc");
  var attendant = root.querySelector("#fiAttendant");
  var journeyDistance = root.querySelector("#fiJourneyDistance");
  var journeyTravellers = root.querySelector("#fiJourneyTravellers");
  var journeyPriority = root.querySelector("#fiJourneyPriority");
  var mediaPanel = root.querySelector("#fiMediaPanel");
  var viewLabel = root.querySelector("#fiViewLabel");
  var mediaTabs = Array.prototype.slice.call(root.querySelectorAll("[data-fi-view]"));
  var categoryButtons = Array.prototype.slice.call(root.querySelectorAll("[data-fi-category]"));
  var enquire = root.querySelector("#fiEnquire");
  var currentRecommendation = categories[0];
  var currentDistance = 0;

  function normalise(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function findLocation(value) {
    return locations[normalise(value)] || null;
  }

  function nauticalMiles(from, to) {
    var radians = function (degrees) { return degrees * Math.PI / 180; };
    var lat1 = radians(from.lat);
    var lat2 = radians(to.lat);
    var deltaLat = radians(to.lat - from.lat);
    var deltaLon = radians(to.lon - from.lon);
    var value = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return (6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))) / 1.852;
  }

  function selectedPriority() {
    var selected = root.querySelector('input[name="priority"]:checked');
    return selected ? selected.value : "Efficiency";
  }

  function recommendationIndex(distance, travellers, priority) {
    var index = categories.findIndex(function (item) { return distance <= item.maxNm; });
    if (index < 0) index = categories.length - 1;
    var distanceIndex = index;
    while (index < categories.length - 1 && travellers > categories[index].capacity) index += 1;
    var capacityAlreadyRaisedCategory = index > distanceIndex;
    if (priority === "Cabin Space" && !capacityAlreadyRaisedCategory && index < categories.length - 1) index += 1;
    if (priority === "Long-Range Comfort") {
      if (distance > 2500) index = Math.max(index, 3);
      else if (index < categories.length - 1) index += 1;
    }
    return index;
  }

  function explanation(item, from, to, travellers, priority, distance) {
    var distanceContext = distance <= 1500 ? "short regional sector"
      : distance <= 3500 ? "longer regional or transcontinental sector"
      : "long-haul sector";
    var priorityContext = priority === "Efficiency" ? "efficient access without unnecessary cabin scale"
      : priority === "Cabin Space" ? "additional cabin space and ease throughout the journey"
      : "a more restful cabin environment across the route";
    return item.name + " is an indicative fit for this " + distanceContext + " from "
      + from.name + " to " + to.name + " with " + travellers + " traveller"
      + (travellers === 1 ? "" : "s") + ", prioritising " + priorityContext + ".";
  }

  function render(item, message, isExploring) {
    currentRecommendation = item;
    categoryName.textContent = item.name;
    match.textContent = isExploring ? "Category profile" : "Journey fit " + String(categories.indexOf(item) + 1).padStart(2, "0");
    reason.textContent = message;
    range.textContent = item.range;
    capacity.textContent = item.capacityLabel;
    representative.textContent = item.representative;
    representativeNote.textContent = item.representative;
    cabinHeight.textContent = item.cabinHeight;
    cabinHeightDetail.textContent = item.cabinHeight;
    luggageSummary.textContent = item.luggageSummary;
    cabin.textContent = item.cabin;
    luggage.textContent = item.luggage;
    cabinLayout.textContent = item.cabinLayout;
    cabinLength.textContent = item.cabinLength;
    cabinWidth.textContent = item.cabinWidth;
    rangeDetail.textContent = item.range;
    cruise.textContent = item.cruise;
    catering.textContent = item.catering;
    wifi.textContent = item.wifi;
    wc.textContent = item.wc;
    attendant.textContent = item.attendant;
    silhouette.className = "fi-aircraft " + item.silhouette;
    categoryButtons.forEach(function (button) {
      var active = button.getAttribute("data-fi-category") === item.name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function updateRecommendation() {
    var from = findLocation(originInput.value);
    var to = findLocation(destinationInput.value);
    if (!from || !to || from.name === to.name) {
      status.textContent = "Choose two different locations from the supplied city list.";
      return;
    }
    var travellers = Number(travellerSelect.value) || 1;
    var priority = selectedPriority();
    currentDistance = nauticalMiles(from, to);
    var item = categories[recommendationIndex(currentDistance, travellers, priority)];
    var roundedDistance = Math.round(currentDistance / 10) * 10;
    status.textContent = from.name + " to " + to.name + " · approximately "
      + roundedDistance + " nautical miles";
    journeyDistance.textContent = "Approximately " + roundedDistance + " nm";
    journeyTravellers.textContent = travellers + " traveller" + (travellers === 1 ? "" : "s");
    journeyPriority.textContent = priority;
    render(item, explanation(item, from, to, travellers, priority, currentDistance), false);
  }

  [originInput, destinationInput].forEach(function (input) {
    input.addEventListener("change", updateRecommendation);
    input.addEventListener("input", function () {
      if (findLocation(originInput.value) && findLocation(destinationInput.value)) updateRecommendation();
    });
  });
  travellerSelect.addEventListener("change", updateRecommendation);
  root.querySelectorAll('input[name="priority"]').forEach(function (input) {
    input.addEventListener("change", updateRecommendation);
  });

  categoryButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var item = categories.find(function (category) {
        return category.name === button.getAttribute("data-fi-category");
      });
      if (!item) return;
      render(item, item.cabin + " Explore this category, then return to the journey controls for an indicative route-based recommendation.", true);
    });
  });

  mediaTabs.forEach(function (button, index) {
    button.addEventListener("click", function () {
      var view = button.getAttribute("data-fi-view");
      mediaPanel.className = "fi-media-panel fi-view-" + view;
      viewLabel.textContent = view === "cabin" ? "Cabin plan study" : view.charAt(0).toUpperCase() + view.slice(1) + " study";
      mediaTabs.forEach(function (tab) {
        tab.setAttribute("aria-selected", tab === button ? "true" : "false");
      });
    });
    button.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      var direction = event.key === "ArrowRight" ? 1 : -1;
      var next = (index + direction + mediaTabs.length) % mediaTabs.length;
      mediaTabs[next].focus();
      mediaTabs[next].click();
    });
  });

  enquire.addEventListener("click", function () {
    var from = findLocation(originInput.value);
    var to = findLocation(destinationInput.value);
    var travellers = Number(travellerSelect.value) || 1;
    if (from) sessionStorage.setItem("prefill_qFrom", from.name);
    if (to) sessionStorage.setItem("prefill_qTo", to.name);
    sessionStorage.setItem("prefill_qAdults", String(travellers));
    sessionStorage.setItem(
      "prefill_qNotes",
      "Fleet Intelligence consultation: " + currentRecommendation.name
        + " indicated. Journey priority: " + selectedPriority()
        + (currentDistance ? ". Approximate great-circle distance: " + Math.round(currentDistance) + " nm." : ".")
    );
    window.location.href = "/quote";
  });

  updateRecommendation();
})();
