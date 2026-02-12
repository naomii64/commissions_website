function preprocessRadioMenus(){
    const radiomenus = document.querySelectorAll('generate-radio-selection');
    for(const menu of radiomenus){

        const menuLegendText = menu.getAttribute('legend');
        const menuName = menu.getAttribute('name');
        //generate a new object
        const feildset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = menuLegendText;
        feildset.appendChild(legend)

        let isFirstOption = true;

        for(const child of menu.children){
            if(child.tagName.toLowerCase()!='option') continue;
            const childValue = child.getAttribute('value');
            const childID = `radio-${menuName}-${childValue}`;
            const childLabel = child.innerHTML;

            const newChildElm = document.createElement('div');
            const newChildElmInput = document.createElement('input');
            const newChildElmLabel = document.createElement('label');
            
            newChildElmInput.setAttribute('onchange','onRadioSelection(this)')
            newChildElmInput.setAttribute('name',menuName);
            newChildElmInput.setAttribute('type','radio');
            newChildElmInput.setAttribute('value',childValue);
            newChildElmInput.setAttribute('id',childID);
            
            newChildElmLabel.setAttribute('for',childID);
            newChildElmLabel.textContent = childLabel;

            newChildElm.appendChild(newChildElmInput);
            newChildElm.appendChild(newChildElmLabel);

            feildset.appendChild(newChildElm);
        
            if(!isFirstOption) continue;
            isFirstOption = false;

            newChildElmInput.checked = true;
        }

        menu.replaceWith(feildset);
        console.log(feildset.outerHTML);
    }
}
preprocessRadioMenus();