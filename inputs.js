const commSelectionData = {
    initialized: false
};
//create the price display 
const priceDisplay = new RollingNumberDisplay();
document.getElementById('price-display-div').appendChild(priceDisplay.element);
//initialize
for(const v of document.querySelectorAll(`input[type="radio"]`)) onRadioSelection(v);
commSelectionData.initialized=true;
calculatePrice();

/**@param {HTMLInputElement} radioElement */
function onRadioSelection(radioElement){
    const elmChecked = radioElement.checked;
    const elmValue = radioElement.value;
    const elmName = radioElement.name;
    //make sure the elm was checked
    if(!elmChecked) return;
    commSelectionData[elmName] = elmValue;

    if(commSelectionData.initialized) calculatePrice();
    //handle transition
    if(elmName=="shading") beginStyleTransitionTo(elmValue)
}


function calculatePrice(){
    //settings
    const SHADING_MULTIPLIERS = {
        ["sketch"]:         1.0,
        ["black-and-white"]:1.5,
        ["fully-shaded"]:   2.0,
    };

    const PORTION_RPICES = {
        ["head"]:       20.0,
        ["bust-up"]:    30.0,
        ["full-body"]:  40.0,
    };


    //calculate
    
    const shading = SHADING_MULTIPLIERS[commSelectionData["shading"]];
    const portion = PORTION_RPICES[commSelectionData["portion"]];

    const outputValue = (portion*shading)+5;
    
    priceDisplay.scrollToNumber(outputValue);
}
