describe('DEA Dashboard', () => {
  it('should have a header', () => {
    // Start from the index page
    cy.visit('http://localhost:3000/test/ui')
    

    // The new page should contain a header
    cy.get('Header').should('have.text', 'Digital Evidence Archive on AWSSherlock Holmes');
  })
})

export {}
